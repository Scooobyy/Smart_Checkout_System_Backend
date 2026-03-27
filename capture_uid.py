import serial
import time
import sys
import re

# Configuration - Change this to your Arduino port
SERIAL_PORT = 'COM7'
BAUD_RATE = 9600

def main():
    print("\n" + "="*60)
    print("      RFID TAG UID CAPTURE TOOL")
    print("="*60)
    print("\nThis tool captures the UID of RFID tags.")
    print("Use this to register tags in your admin panel.\n")
    
    try:
        # Connect to Arduino
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)
        ser.reset_input_buffer()
        print(f"✓ Connected to Arduino on {SERIAL_PORT}")
        print("\n📋 Ready to capture UIDs!")
        print("   Tap any RFID card on the reader...")
        print("   Press Ctrl+C to exit\n")
        print("-"*60)
        
        captured_uids = []
        
        while True:
            if ser.in_waiting:
                line = ser.readline().decode('utf-8').strip()
                
                if line:
                    print(f"  {line}")
                    
                    # Look for TAG_SCANNED lines
                    if "TAG_SCANNED:" in line:
                        # Extract the full UID
                        parts = line.split("TAG_SCANNED:")
                        if len(parts) > 1:
                            uid = parts[1].strip()
                            # Make sure UID is in correct format (XX:XX:XX:XX)
                            if re.match(r'^[A-F0-9]{2}(:[A-F0-9]{2})*$', uid):
                                print("\n" + "🎯"*20)
                                print(f"🎯 TAG UID CAPTURED!")
                                print(f"   UID: {uid}")
                                print("🎯"*20)
                                
                                # Save to file
                                with open("captured_uid.txt", "a") as f:
                                    f.write(f"{uid}\n")
                                
                                print(f"\n✓ UID saved to captured_uid.txt")
                                print("\n📋 Next steps:")
                                print("   1. Go to Admin Dashboard → Tags")
                                print(f"   2. Register this UID: {uid}")
                                print("   3. Assign it to a product")
                                print("\n" + "-"*60)
                                
                                captured_uids.append(uid)
                                
                                # Send beep to Arduino
                                ser.write(b"BEEP\n")
            
            time.sleep(0.05)
            
    except serial.SerialException as e:
        print(f"\n✗ Error: {e}")
        print(f"\n💡 Troubleshooting:")
        print(f"   1. Make sure Arduino is connected on {SERIAL_PORT}")
        print("   2. Close Arduino IDE if it's open")
        print("   3. Check Device Manager for correct COM port")
    except KeyboardInterrupt:
        print("\n\n" + "="*60)
        print(f"📊 Summary: Captured {len(captured_uids)} UID(s)")
        if captured_uids:
            print("\n📋 Captured UIDs:")
            for uid in captured_uids:
                print(f"   - {uid}")
        print("\n✓ Exiting...")
        print("="*60)
    finally:
        if 'ser' in locals():
            ser.close()
            print("\nDisconnected from Arduino")

if __name__ == "__main__":
    main()