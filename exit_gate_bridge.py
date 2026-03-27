import serial
import requests
import time
import threading
import re
from datetime import datetime

# Configuration
SERIAL_PORT = 'COM7'  # Change to your port
BAUD_RATE = 9600
BACKEND_URL = 'http://localhost:5000/api'
VALIDATE_URL = f"{BACKEND_URL}/exit-gate/validate"

# Global variables
scanned_tags = []
validation_timeout = None
lock = threading.Lock()
ser = None  # Will be set in main

def connect_serial():
    """Connect to Arduino"""
    global ser
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1, exclusive=True)
        time.sleep(2)
        ser.reset_input_buffer()
        ser.reset_output_buffer()
        print(f"✓ Connected to Arduino on {SERIAL_PORT}")
        return True
    except serial.SerialException as e:
        print(f"✗ Failed to connect: {e}")
        print(f"\n💡 Troubleshooting:")
        print(f"   1. Close Arduino IDE if it's open")
        print(f"   2. Check if port {SERIAL_PORT} is correct")
        print(f"   3. Unplug and replug Arduino")
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}")
        return False

def validate_tags(tags):
    """Send tags to backend for payment verification"""
    if not tags:
        return None
    
    print(f"\n{'='*50}")
    print(f"🔄 Validating tag: {tags[0]}")
    print(f"⏰ Time: {datetime.now().strftime('%H:%M:%S')}")
    
    try:
        payload = {"uhf_uids": tags}
        response = requests.post(VALIDATE_URL, json=payload, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            result = data.get('data', {})
            
            if result.get('all_paid'):
                print(f"✅ PAID - Gate opening")
                return "PAID"
            else:
                unpaid = result.get('unpaid_items', [])
                if unpaid:
                    item = unpaid[0]
                    reason = item.get('reason', 'Unpaid')
                    product = item.get('product_name', 'Unknown')
                    print(f"❌ UNPAID - {product}: {reason}")
                else:
                    print(f"❌ UNPAID - No payment found")
                return "UNPAID"
        else:
            print(f"⚠️ API Error: {response.status_code}")
            return "ERROR"
            
    except requests.exceptions.ConnectionError:
        print("❌ Backend not running! Start with: npm run dev")
        return "ERROR"
    except Exception as e:
        print(f"❌ Error: {e}")
        return "ERROR"

def send_command(command):
    """Send command to Arduino"""
    global ser
    if ser and ser.is_open:
        ser.write(f"{command}\n".encode())
        print(f"→ Sent: {command}")

def delayed_validate():
    """Validate scanned tags after delay"""
    global scanned_tags, validation_timeout
    
    with lock:
        if scanned_tags:
            tags_to_validate = scanned_tags.copy()
            scanned_tags = []
            result = validate_tags(tags_to_validate)
            if result:
                send_command(result)

def main():
    global ser, scanned_tags, validation_timeout
    
    print("\n" + "="*60)
    print("      EXIT GATE SECURITY SYSTEM")
    print("="*60)
    print(f"📡 Backend: {BACKEND_URL}")
    print(f"🔌 Serial Port: {SERIAL_PORT}")
    print("-"*60)
    
    # Connect to Arduino
    if not connect_serial():
        input("\nPress Enter to exit...")
        return
    
    print("\n✅ System READY!")
    print("📋 Instructions:")
    print("   1. Tap registered RFID tag on reader")
    print("   2. System will check payment status")
    print("   3. Green LED + Beep = PAID → Gate opens")
    print("   4. Red LED + Alarm = UNPAID → Security alert")
    print("\n" + "="*60)
    print("🟢 Waiting for RFID scans...")
    print("Press Ctrl+C to exit\n")
    
    try:
        while True:
            if ser.in_waiting:
                line = ser.readline().decode('utf-8').strip()
                
                if line:
                    print(f"← {line}")
                    
                    if "TAG_SCANNED:" in line:
                        # Extract full UID
                        parts = line.split("TAG_SCANNED:")
                        if len(parts) > 1:
                            tag = parts[1].strip()
                            # Validate UID format (XX:XX:XX:XX)
                            if re.match(r'^[A-F0-9]{2}(:[A-F0-9]{2})+$', tag):
                                print(f"  → Tag detected: {tag}")
                                
                                with lock:
                                    scanned_tags = [tag]
                                
                                # Cancel previous timeout
                                if validation_timeout:
                                    validation_timeout.cancel()
                                
                                # Set new timeout
                                validation_timeout = threading.Timer(1.5, delayed_validate)
                                validation_timeout.start()
                            else:
                                print(f"  ⚠️ Invalid UID format: {tag}")
                    
                    elif line == "GATE_OPEN":
                        print("  🚪 Gate opened successfully!")
                        
                    elif line == "ALARM_TRIGGERED":
                        print("  🚨 ALARM! Security notified!")
                        
                    elif line == "SYSTEM_ERROR":
                        print("  ⚠️ System error occurred")
                        
                    elif "Hardware test complete" in line:
                        print("  ✅ Hardware OK")
            
            time.sleep(0.05)
            
    except KeyboardInterrupt:
        print("\n\n" + "="*60)
        print("🛑 Shutting down exit gate system...")
        if validation_timeout:
            validation_timeout.cancel()
        if ser and ser.is_open:
            ser.close()
        print("✓ Disconnected from Arduino")
        print("✓ Bridge stopped")
        print("="*60)

if __name__ == "__main__":
    main()