import os
import shutil

# 1. CONFIGURE YOUR PATH HERE
# Replace 'YourName' with your actual Windows username
# The 'r' before the quotes is CRITICAL for Windows paths
directory = r'C:\Users\Yash Desai\Downloads' 

# 2. DEFINE CATEGORIES
extension_map = {
    'Images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
    'Documents': ['.pdf', '.docx', '.txt', '.xlsx', '.pptx', '.csv'],
    'Installers': ['.exe', '.msi'],
    'Archives': ['.zip', '.rar', '.7z'],
    'Videos': ['.mp4', '.mov', '.avi']
}

def organize_files():
    # Check if the path actually exists to avoid errors
    if not os.path.exists(directory):
        print(f"❌ Error: The path '{directory}' does not exist. Check your username!")
        return

    print(f"🔍 Scanning: {directory}...")

    for filename in os.listdir(directory):
        # Skip folders and the script itself
        filepath = os.path.join(directory, filename)
        if os.path.isdir(filepath) or filename == 'organizer.py':
            continue

        # Get the file extension
        file_ext = os.path.splitext(filename)[1].lower()

        # Match extension to folder
        for folder_name, extensions in extension_map.items():
            if file_ext in extensions:
                target_folder = os.path.join(directory, folder_name)
                
                # CREATE FOLDER IF MISSING
                if not os.path.exists(target_folder):
                    os.makedirs(target_folder)
                
                # MOVE FILE WITH ERROR HANDLING
                try:
                    shutil.move(filepath, os.path.join(target_folder, filename))
                    print(f"✅ Moved: {filename} -> {folder_name}")
                except PermissionError:
                    print(f"⚠️ Skipped: {filename} (File is currently open/in use)")
                except Exception as e:
                    print(f"❌ Error moving {filename}: {e}")

if __name__ == "__main__":
    organize_files()
    print("\n✨ Clean-up complete!")