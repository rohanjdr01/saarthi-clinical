import json
import csv
import re
import os

def normalize_path(path):
    # Remove base URLs
    path = path.replace('{{baseUrl}}', '')
    path = path.replace('{{localUrl}}', '')
    path = path.replace('{{stagingUrl}}', '')
    path = path.replace('http://localhost:8787/api/v1', '')
    path = path.replace('/api/v1', '')
    
    # Normalize parameters
    # {{patientId}} -> :id
    # :patientId -> :id
    # :id -> :id
    # Let's just replace all {{...}} and :... with a placeholder for matching, or try to keep them consistent.
    # Actually, let's just strip them to compare structure if possible, or regex replace.
    # Better: replace `{{[^}]+}}` with `{param}` and `:[^/]+` with `{param}`
    
    path = re.sub(r'\{\{[^}]+\}\}', '{param}', path)
    path = re.sub(r':[^/]+', '{param}', path)
    
    if not path.startswith('/'):
        path = '/' + path
        
    return path.strip()

def parse_postman(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    endpoints = []
    
    def recurse(items, folder_name=''):
        for item in items:
            if 'item' in item:
                # Folder
                new_folder = f"{folder_name} > {item['name']}" if folder_name else item['name']
                recurse(item['item'], new_folder)
            elif 'request' in item:
                # Request
                req = item['request']
                name = item['name']
                method = req['method']
                
                # URL can be string or object
                url_obj = req['url']
                if isinstance(url_obj, str):
                    url = url_obj
                else:
                    url = url_obj.get('raw', '')
                
                # Body
                body = None
                if 'body' in req and 'raw' in req['body']:
                    try:
                        body = json.loads(req['body']['raw'])
                    except:
                        body = req['body']['raw'] # Keep as string if not json
                
                endpoints.append({
                    'name': name,
                    'folder': folder_name,
                    'method': method,
                    'url': url,
                    'normalized_url': normalize_path(url),
                    'request_body': body,
                    'description': req.get('description', '')
                })

    recurse(data.get('item', []))
    return endpoints

def parse_markdown_responses(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
        
    responses = {} # Key: "METHOD NORMALIZED_URL" -> json_obj
    
    # Regex to find blocks
    # ### Title
    # ```
    # METHOD /url
    # ```
    # ...
    # **Response:**
    # ```json
    # { ... }
    # ```
    
    lines = content.split('\n')
    i = 0
    current_method = None
    current_url = None
    
    while i < len(lines):
        line = lines[i].strip()
        
        # Endpoint definition
        if (line.startswith('GET /') or line.startswith('POST /') or 
            line.startswith('PUT /') or line.startswith('DELETE /') or 
            line.startswith('PATCH /')):
            
            parts = line.split(' ', 1)
            if len(parts) == 2:
                current_method = parts[0]
                current_url = normalize_path(parts[1])
        
        # Response block
        if '**Response' in line:
            # Look for json block
            j = i + 1
            json_lines = []
            found_json = False
            while j < len(lines):
                l = lines[j] # Don't strip yet to preserve structure? JSON doesn't care.
                if l.strip().startswith('```json'):
                    found_json = True
                    j += 1
                    continue
                if l.strip().startswith('```') and found_json:
                    # End of block
                    try:
                        json_str = '\n'.join(json_lines)
                        resp_obj = json.loads(json_str)
                        key = f"{current_method} {current_url}"
                        responses[key] = resp_obj
                    except:
                        pass
                    break
                if found_json:
                    json_lines.append(l)
                j += 1
            i = j
        
        i += 1
        
    return responses

def flatten_json(y, parent_key='', sep='.'):
    items = []
    if isinstance(y, dict):
        for k, v in y.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            items.extend(flatten_json(v, new_key, sep=sep).items())
    elif isinstance(y, list):
        if len(y) > 0:
            if isinstance(y[0], dict):
                 items.extend(flatten_json(y[0], f"{parent_key}[]", sep=sep).items())
            else:
                items.append((f"{parent_key}[]", y[0]))
        else:
            items.append((f"{parent_key}[]", []))
    else:
        items.append((parent_key, y))
    return dict(items)

def get_type_name(val):
    if isinstance(val, bool):
        return "boolean"
    elif isinstance(val, int):
        return "integer"
    elif isinstance(val, float):
        return "float"
    elif isinstance(val, str):
        return "string"
    elif isinstance(val, list):
        return "array"
    elif isinstance(val, dict):
        return "object"
    elif val is None:
        return "null"
    else:
        return str(type(val))

def main():
    postman_file = 'postman_collection.json'
    md_file = 'API_ENDPOINTS.md'
    
    endpoints = parse_postman(postman_file)
    responses = parse_markdown_responses(md_file)
    
    csv_file = 'route_details_final.csv'
    
    with open(csv_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Route Name', 'Method', 'URL', 'Output Variable Name', 'Variable Type', 'Example', 'Source'])
        
        for ep in endpoints:
            name = ep['name']
            method = ep['method']
            url = ep['url']
            norm_url = ep['normalized_url']
            
            key = f"{method} {norm_url}"
            
            # Try to find response
            resp_data = responses.get(key)
            source = "API Docs"
            
            if not resp_data:
                # Fallback to request body if available (for POST/PUT)
                if ep['request_body'] and isinstance(ep['request_body'], dict):
                    resp_data = ep['request_body']
                    source = "Inferred from Request"
                else:
                    source = "No Example"
            
            if resp_data:
                if isinstance(resp_data, (dict, list)):
                    flat = flatten_json(resp_data)
                    for k, v in flat.items():
                        writer.writerow([name, method, url, k, get_type_name(v), str(v)[:100], source])
                else:
                     writer.writerow([name, method, url, 'response', get_type_name(resp_data), str(resp_data)[:100], source])
            else:
                writer.writerow([name, method, url, 'N/A', 'N/A', 'N/A', source])

    print(f"Generated {csv_file}")

if __name__ == '__main__':
    main()
