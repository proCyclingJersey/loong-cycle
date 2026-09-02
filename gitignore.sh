# Dependencies
node_modules/

# Environment
.env

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db
desktop.ini

# Editor
.vscode/
.idea/
*.swp
*.swo

# ---- IMPORTANT: Do NOT ignore these ----
# uploads/ contains all product images (organized by category/album)
# data/ contains categories.json which the website reads
# Both must be committed to git for the website to work!
!uploads/
!data/

# Build / temp (if any)
static/
dist/
build/
tmp/
temp/
