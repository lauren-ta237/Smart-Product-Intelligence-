# python bundle_code.py
import os
import sys

# Directories to skip (prevents huge, useless files from filling the context)
IGNORE_DIRS = {
    "node_modules", ".next", "venv", ".venv", "__pycache__", 
    ".git", ".idea", ".vscode", "dist", "build", "coverage", ".pytest_cache"
}

# File extensions that contain real code or config
ALLOWED_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".json", 
    ".html", ".css", ".env.example", ".prisma", ".sql", ".md"
}

# Large/lock files to skip
IGNORE_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", 
    "full_stack_context.txt", "bundle_code.py"
}

OUTPUT_FILE = "full_stack_context.txt"

def build_tree(start_path):
    """Generates a visual directory tree structure for Gemini."""
    tree_str = "PROJECT DIRECTORY STRUCTURE:\n"
    tree_str += "=" * 40 + "\n"
    for root, dirs, files in os.walk(start_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        level = root.replace(start_path, '').count(os.sep)
        indent = ' ' * 4 * (level)
        tree_str += f"{indent}{os.path.basename(root)}/\n"
        subindent = ' ' * 4 * (level + 1)
        for f in files:
            if f not in IGNORE_FILES and os.path.splitext(f)[1].lower() in ALLOWED_EXTENSIONS:
                tree_str += f"{subindent}{f}\n"
    tree_str += "=" * 40 + "\n\n"
    return tree_str

def bundle_project():
    print("⏳ Bundling full-stack project...")
    file_count = 0
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
        # 1. Write visual tree header so Gemini understands the exact file paths
        out.write(build_tree("."))
        
        # 2. Append all actual source files with headers
        for root, dirs, files in os.walk("."):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                if file in IGNORE_FILES:
                    continue
                
                ext = os.path.splitext(file)[1].lower()
                if ext in ALLOWED_EXTENSIONS or file in {"Dockerfile", "docker-compose.yml"}:
                    file_path = os.path.join(root, file)
                    # Normalize paths for clean display
                    clean_path = file_path.replace("\\", "/")
                    
                    try:
                        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                            out.write(f"\n\n{'='*25} FILE START: {clean_path} {'='*25}\n\n")
                            out.write(content)
                            out.write(f"\n\n{'='*25} FILE END: {clean_path} {'='*25}\n")
                            file_count += 1
                    except Exception as e:
                        print(f"Skipping {clean_path}: {e}")

    print(f"✅ SUCCESS! Bundled {file_count} files into '{OUTPUT_FILE}'.")
    print(f"📁 Simply upload '{OUTPUT_FILE}' to Google AI Studio!")

if __name__ == "__main__":
    bundle_project()