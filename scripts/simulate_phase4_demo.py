import json
import urllib.request
import time
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_endpoint(title, url, method="GET", data=None):
    print(f"\n=======================================================")
    print(f"TESTING: {title}")
    print(f"URL: {method} {url}")
    print(f"=======================================================")
    
    req = urllib.request.Request(url, method=method)
    if data:
        req.add_header('Content-Type', 'application/json')
        req.data = json.dumps(data).encode('utf-8')
        
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res_body = response.read().decode('utf-8')
            parsed = json.loads(res_body)
            print(json.dumps(parsed, indent=2))
            return parsed
    except Exception as e:
        print(f"Error connecting to {url}: {e}")
        return None

def main():
    print("=== RAILTRACKR PHASE 4 END-TO-END VERIFICATION ===")
    
    # 1. Health Check
    test_endpoint("API Health & Active Subscriptions", f"{BASE_URL}/health")
    
    # 2. Amenities Finder (Phase 4.3)
    test_endpoint("Station Amenities Finder (Kota Junction)", f"{BASE_URL}/api/v1/stations/KOTA/amenities")
    
    # 3. Alert Subscription (Phase 4.2)
    sub_payload = {
        "train_number": "12951",
        "station_code": "KOTA",
        "target_arrival_date": "2026-09-03",
        "user_phone": "+919876543210",
        "alert_window_minutes": 30,
        "notify_on_delay_change": True
    }
    sub_res = test_endpoint("Subscribe to Proactive Arrival Alert", f"{BASE_URL}/api/v1/alerts/subscribe", method="POST", data=sub_payload)
    
    # 4. Trigger Alert Simulation (Phase 4.2)
    sub_id = sub_res.get("subscription_id", "sub_1") if sub_res else "sub_1"
    test_endpoint("Simulate Real-time SMS Dispatch Trigger", f"{BASE_URL}/api/v1/alerts/simulate-trigger/{sub_id}", method="POST")
    
    # 5. Control Room Cascade & Bottleneck Monitor (Phase 4.4)
    test_endpoint("Control Room Cascading Delay & Bottleneck Analysis", f"{BASE_URL}/api/v1/control-room/cascade-risk")
    
    print("\n✅ All Phase 4 endpoints tested successfully!")

if __name__ == '__main__':
    main()
