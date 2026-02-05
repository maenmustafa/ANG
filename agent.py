
#!/usr/bin/python3
import psutil, json, os, logging, signal, shutil, datetime, smtplib, time, threading, sys, uuid, subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import urllib.request
import mimetypes # Import mimetypes for serving static files

CONFIG_PATH = '/etc/ang-monitor/config.json'
REVERT_PATH = '/etc/ang-monitor/revert_state.json'
LOG_PATH = '/opt/ang-monitor/audit.log'
AGENT_ID_PATH = '/etc/ang-monitor/agent_id'

HUB_AGENTS = {}

def get_agent_id():
    if os.path.exists(AGENT_ID_PATH):
        try:
            with open(AGENT_ID_PATH, 'r') as f: return f.read().strip()
        except: pass
    new_id = str(uuid.uuid4())[:8]
    try:
        os.makedirs(os.path.dirname(AGENT_ID_PATH), exist_ok=True)
        with open(AGENT_ID_PATH, 'w') as f: f.write(new_id)
    except: pass
    return new_id

AGENT_ID = get_agent_id()

def log_audit(event):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        with open(LOG_PATH, 'a') as f:
            f.write(f"[{timestamp}] {event}\n")
    except: pass

def load_config():
    defaults = {
        "customerName": f"SLES-{AGENT_ID}",
        "memoryThresholdGB": 2.0,
        "partitions": [{"path": "/", "enabled": True, "threshold": 90}],
        "email": {
            "smtpServer": "", "port": 587, "username": "", 
            "token": "", "recipients": "", "alertCooldownHours": 6, "useTLS": True
        },
        "intervals": { # Add default intervals
            "ram": 5,
            "disk": 10,
            "process": 5
        }
    }
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r') as f:
                cfg = json.load(f)
                # Ensure all default keys exist, even if new in later versions
                for key, default_val in defaults.items():
                    if key not in cfg:
                        cfg[key] = default_val
                    elif isinstance(default_val, dict) and isinstance(cfg[key], dict):
                        for sub_key, sub_default_val in default_val.items():
                            if sub_key not in cfg[key] or cfg[key][sub_key] is None:
                                cfg[key][sub_key] = sub_default_val
                return cfg
        except Exception as e:
            log_audit(f"Error loading config: {e}")
            pass # Fallback to defaults if file is corrupt
    return defaults

def save_config(data):
    try:
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        if 'email' in data and (data['email'].get('port') is None or data['email'].get('port') == ""):
            data['email']['port'] = 587
        with open(CONFIG_PATH, 'w') as f: json.dump(data, f, indent=4)
        return True
    except Exception as e:
        log_audit(f"Error saving config: {e}")
        return False

def get_detailed_server_info():
    info = {}
    try:
        output = subprocess.check_output(['hostnamectl'], stderr=subprocess.STDOUT).decode()
        for line in output.split('\n'):
            if ":" in line:
                k, v = line.split(":", 1)
                info[k.strip()] = v.strip()
    except: pass
    try:
        lscpu = subprocess.check_output(['lscpu'], stderr=subprocess.STDOUT).decode()
        for line in lscpu.split('\n'):
            if "Model name:" in line: info['CPU Model'] = line.split(":", 1)[1].strip()
        info['Total Threads'] = os.cpu_count()
    except: pass
    
    # HANA Version
    info['SAP HANA Version'] = "N/A"
    info['HANA Installation Date'] = "N/A"
    hana_history = '/hana/shared/NDB/global/hdb/versionhistory.csv'
    if os.path.exists(hana_history):
        try:
            with open(hana_history, 'r') as f:
                lines = [l.strip() for l in f.readlines() if l.strip()]
                if lines:
                    parts = lines[-1].split(';')
                    if len(parts) >= 2:
                        info['HANA Installation Date'] = parts[0].split(' ')[0]
                        info['SAP HANA Version'] = parts[1].strip()
        except: pass

    # SAP Business One Version - Special Extraction
    info['SAP Business One Version'] = "N/A"
    try:
        b1_setup = '/usr/sap/SAPBusinessOne/setup'
        if os.path.exists(b1_setup):
            output = subprocess.check_output([b1_setup, '-v'], stderr=subprocess.STDOUT).decode()
            lines = [l.strip() for l in output.split('\n') if l.strip()]
            if len(lines) >= 2:
                # Use the second line of the version number only
                info['SAP Business One Version'] = lines[1]
    except: pass

    return info

def get_tuning_params():
    mem = psutil.virtual_memory()
    page_size = os.sysconf('SC_PAGE_SIZE')
    return {
        "vm.max_map_count": "2147483647",
        "kernel.pid_max": "4194304",
        "kernel.numa_balancing": "0",
        "kernel.shmmax": str(mem.total),
        "kernel.shmall": str(mem.total // page_size),
        "fs.aio-max-nr": "1048576",
        "net.core.somaxconn": "4096",
        "thp_enabled": "never",
        "ksm_run": "0"
    }

def scan_tune():
    recommended = get_tuning_params()
    results = []
    for param, rec in recommended.items():
        current = "N/A"
        try:
            if param == "thp_enabled":
                if os.path.exists('/sys/kernel/mm/transparent_hugepage/enabled'):
                    content = open('/sys/kernel/mm/transparent_hugepage/enabled').read()
                    current = content.split('[')[1].split(']')[0] if '[' in content else content.strip()
            elif param == "ksm_run":
                if os.path.exists('/sys/kernel/mm/ksm/run'):
                    current = open('/sys/kernel/mm/ksm/run').read().strip()
            else:
                current = subprocess.check_output(['sysctl', '-n', param]).decode().strip()
        except: pass
        results.append({"param": param, "current": current, "recommended": rec, "status": "OK" if str(current) == str(rec) else "MISMATCH"})
    return results

def handle_task(task):
    t_type = task.get('type'); args = task.get('args', {})
    try:
        if t_type == 'set_config': return {"status": "ok", "type": "config"} if save_config(args) else {"error": "save failed"}
        if t_type == 'kill': os.kill(args['pid'], signal.SIGKILL); log_audit(f"Killed Process: {args['pid']}"); return {"status": "ok"}
        if t_type == 'ls':
            p = args.get('path', '/'); items = []
            if os.path.exists(p):
                for f in os.listdir(p):
                    full = os.path.join(p, f); is_dir = os.path.isdir(full); 
                    try: s = os.path.getsize(full) if not is_dir else 0
                    except: s = 0
                    items.append({'name': f, 'full_path': full, 'type': 'dir' if is_dir else 'file', 'size': f"{round(s/1024/1024,2)} MB" if s > 1024 else "-"})
            return {"type": "ls", "data": sorted(items, key=lambda x: (x['type']!='dir', x['name']))}
        if t_type == 'scan_tune': return {"type": "tune_results", "data": scan_tune()}
        if t_type == 'apply_tune':
            recommended = get_tuning_params()
            revert_state = {}
            for param, val in recommended.items():
                try:
                    current = ""
                    if param == "thp_enabled": pass
                    elif param == "ksm_run": pass
                    else:
                        current = subprocess.check_output(['sysctl', '-n', param]).decode().strip()
                        subprocess.call(['sysctl', '-w', f"{param}={val}"])
                        revert_state[param] = current
                except: pass
            with open(REVERT_PATH, 'w') as f: json.dump(revert_state, f)
            log_audit("Applied SAP Tunings")
            return {"type": "tune_apply", "status": "ok"}
        if t_type == 'revert_tune':
            if os.path.exists(REVERT_PATH):
                with open(REVERT_PATH, 'r') as f:
                    revert_state = json.load(f)
                    for param, val in revert_state.items():
                        subprocess.call(['sysctl', '-w', f"{param}={val}"])
                log_audit("Reverted SAP Tunings")
                return {"type": "tune_revert", "status": "ok"}
            return {"error": "no revert state found"}
        if t_type == 'rm':
            path = args.get('path')
            if os.path.isdir(path): shutil.rmtree(path)
            else: os.remove(path)
            log_audit(f"Deleted Path: {path}")
            return {"status": "ok", "type": "rm"}
    except Exception as e: return {"error": str(e)}
    return None

def get_stats():
    cfg = load_config(); mem = psutil.virtual_memory(); disk_stats = []
    for p in cfg.get('partitions', []):
        try:
            u = psutil.disk_usage(p['path'])
            disk_stats.append({'path': p['path'], 'usage_pct': round(u.percent, 1), 'free_gb': round(u.free/(1024**3), 1), 'total_gb': round(u.total/(1024**3),1)})
        except: pass
    procs = []
    for pr in psutil.process_iter(['pid', 'name', 'memory_info', 'username']):
        try:
            m = round(pr.info['memory_info'].rss / (1024**3), 2)
            if m > 0.05: procs.append({'pid': pr.info['pid'], 'name': pr.info['name'], 'memGB': m, 'user': pr.info['username']})
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue # Skip processes that no longer exist or are inaccessible
        except Exception as e:
            log_audit(f"Error getting process info: {e}")
            continue

    # Get IP address
    ip_address = 'N/A'
    try:
        # This will get the internal IP on Fly.io or local IP
        # For public IP, usually requires external service. '0.0.0.0' for binding.
        ip_address = subprocess.check_output(['hostname', '-I']).decode().split()[0]
    except:
        pass # If command fails, keep N/A


    return {
        'agentId': AGENT_ID, 'customerName': cfg.get('customerName'),
        'memoryTotal': round(mem.total/(1024**3),2), 'memoryFree': round(mem.free/(1024**3),2),
        'swapUsagePct': psutil.swap_memory().percent, 'diskStats': disk_stats,
        'topProcesses': sorted(procs, key=lambda x: x['memGB'], reverse=True)[:10],
        'oomDetected': "Out of memory" in os.popen("dmesg | tail -n 20").read(),
        'serverInfo': get_detailed_server_info(), 
        'config': cfg,
        'ipAddress': ip_address,
        'lastUpdate': datetime.datetime.now().isoformat()
    }

def agent_push_loop():
    print(f"ANG Agent (ID: {AGENT_ID}) Loop Active...")
    while True:
        try:
            cfg = load_config()
            # Localhost loopback
            hub = "http://127.0.0.1:9090"
            payload = {'current_config': cfg, 'stats': get_stats()}
            req = urllib.request.Request(f"{hub}/hub/heartbeat", data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json', 'X-Agent-ID': AGENT_ID})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                for task in data.get('tasks', []):
                    res = handle_task(task)
                    if res:
                        res_req = urllib.request.Request(f"{hub}/hub/result", data=json.dumps({'agentId': AGENT_ID, 'result': res}).encode(), headers={'Content-Type': 'application/json'})
                        urllib.request.urlopen(res_req, timeout=5)
        except Exception as e:
            log_audit(f"Agent push loop error: {e}")
            pass
        time.sleep(2)

# Helper to determine MIME type for static files
def get_mimetype(filepath):
    mime_type, _ = mimetypes.guess_type(filepath)
    if filepath.endswith(('.tsx', '.ts', '.js')): # Explicitly handle TS/TSX as JS modules
        return 'application/javascript'
    elif not mime_type:
        return 'application/octet-stream' # Default if unknown
    return mime_type

class HubRelayHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): return

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Agent-ID')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def _serve_static_file(self, local_path):
        try:
            # Ensure local_path is safe and within current directory or approved subdirectories
            # This is a simple check, for production, more robust path sanitization might be needed.
            if not os.path.normpath(local_path).startswith(os.getcwd()):
                raise FileNotFoundError(f"Access to path outside working directory: {local_path}")

            if not os.path.exists(local_path) or not os.path.isfile(local_path):
                raise FileNotFoundError(f"File not found: {local_path}")

            mime_type = get_mimetype(local_path)

            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-type', mime_type)
            self.send_header('Content-Length', str(os.path.getsize(local_path)))
            self.end_headers()

            with open(local_path, 'rb') as f:
                self.wfile.write(f.read())
        except FileNotFoundError:
            self.send_response(404)
            self.send_cors_headers()
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'404 Not Found')
        except Exception as e:
            self.send_response(500)
            self.send_cors_headers()
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(f'500 Internal Server Error: {e}'.encode())
            log_audit(f"Error serving static file {local_path}: {e}")

    def do_GET(self):
        parsed_path = urlparse(self.path).path

        if parsed_path == '/favicon.ico':
            self._serve_static_file('favicon.ico') # Ensure favicon is also served if exists
            return

        # --- API Endpoints (GET) ---
        if parsed_path == '/hub/agents':
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(HUB_AGENTS).encode())
            return
        elif parsed_path == '/hub/clear-result':
            aid = parse_qs(urlparse(self.path).query).get('agentId', [None])[0]
            if aid in HUB_AGENTS: HUB_AGENTS[aid]['last_result'] = None
            self.send_response(200) # Send 200 for successful clear
            self.send_cors_headers()
            self.end_headers()
            return
        elif parsed_path == '/stats':
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(get_stats()).encode())
            return
        elif parsed_path == '/load-config':
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(load_config()).encode())
            return
        elif parsed_path == '/logs':
            try:
                with open(LOG_PATH, 'rb') as f:
                    self.send_response(200)
                    self.send_cors_headers()
                    self.send_header('Content-type', 'text/plain')
                    self.end_headers()
                    self.wfile.write(f.read())
            except FileNotFoundError:
                self.send_response(404)
                self.send_cors_headers()
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(b"No logs found.")
            except Exception as e:
                self.send_response(500)
                self.send_cors_headers()
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(f'500 Internal Server Error: {e}'.encode())
            return

        # --- Static File Serving ---
        elif parsed_path == '/' or parsed_path == '/index.html':
            self._serve_static_file('index.html')
        elif parsed_path in ['/index.tsx', '/App.tsx', '/types.ts', '/index.css', '/metadata.json']:
            self._serve_static_file(parsed_path.lstrip('/'))
        elif parsed_path.startswith('/components/'):
            # This handles requests like /components/Dashboard.tsx
            self._serve_static_file(parsed_path.lstrip('/'))
        else:
            self.send_response(404)
            self.send_cors_headers()
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'404 Not Found')

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        data = json.loads(self.rfile.read(content_length).decode())

        # --- API Endpoints (POST) ---
        if self.path == '/hub/heartbeat':
            aid = self.headers.get('X-Agent-ID')
            if aid:
                if aid not in HUB_AGENTS: HUB_AGENTS[aid] = {'tasks': [], 'stats': {}, 'last_result': None}
                HUB_AGENTS[aid].update({'last_seen': time.time(), 'stats': data['stats'], 'config': data['current_config']})
                self.send_response(200)
                self.send_cors_headers()
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'tasks': HUB_AGENTS[aid].pop('tasks', [])}).encode())
            else:
                self.send_response(400) # Bad Request if no X-Agent-ID
                self.send_cors_headers()
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'400 Bad Request: X-Agent-ID header missing.')
            return
        elif self.path == '/hub/task':
            aid = data.get('agentId')
            if aid in HUB_AGENTS: HUB_AGENTS[aid].setdefault('tasks', []).append(data)
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"queued"}')
            return
        elif self.path == '/hub/result':
            aid = data.get('agentId')
            if aid in HUB_AGENTS: HUB_AGENTS[aid]['last_result'] = data.get('result')
            self.send_response(200)
            self.send_cors_headers()
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return
        elif self.path == '/config': # Frontend POST to save config
            if save_config(data):
                self.send_response(200)
                self.send_cors_headers()
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status":"ok"}')
            else:
                self.send_response(500)
                self.send_cors_headers()
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status":"error", "message":"Failed to save config"}')
            return
        else:
            self.send_response(404)
            self.send_cors_headers()
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'404 Not Found')


if __name__ == "__main__":
    if "--agent" in sys.argv: agent_push_loop()
    else:
        threading.Thread(target=agent_push_loop, daemon=True).start()
        print("ANG Hub starting on 0.0.0.0:9090...")
        HTTPServer(('0.0.0.0', 9090), HubRelayHandler).serve_forever()
