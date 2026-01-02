# 📂 Automated File Organizer (Python)

A smart Python utility that declutters your folders by automatically categorizing files into organized subdirectories based on their extensions.

## 🚀 Features
- **Dynamic Folder Creation:** Automatically creates folders (Images, Docs, etc.) if they don't already exist.
- **Error Handling:** Built-in protection against `PermissionError` (if a file is open) and other system interruptions.
- **Categorization:** Pre-configured for common file types (PDFs, Images, Archives, Installers).
- **Safe Execution:** Skips the script itself and other directories to prevent accidental loops.

## 🛠️ How It Works
The script uses the `os` and `shutil` libraries to scan a target directory. It identifies file extensions and moves them to their corresponding destination.



## 📋 Requirements
- Python 3.x
- No external libraries required (uses standard Python library)

## 🔧 Setup & Usage
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YOUR_USERNAME/file-organizer.git](https://github.com/YOUR_USERNAME/file-organizer.git)
