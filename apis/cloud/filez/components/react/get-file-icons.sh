#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Fetching vscode-material-icon-theme...${NC}"

# Clean up any existing clone
if [ -d "./vscode-material-icon-theme" ]; then
    echo -e "${YELLOW}Removing existing vscode-material-icon-theme directory...${NC}"
    rm -rf ./vscode-material-icon-theme
fi

# Clone the repository
git clone --depth 1 https://github.com/PKief/vscode-material-icon-theme

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to clone vscode-material-icon-theme repository${NC}"
    exit 1
fi

echo -e "${GREEN}Successfully cloned vscode-material-icon-theme${NC}"

# Copy icons to lib/assets directory
echo -e "${YELLOW}Copying icons to public/assets/file-icons/...${NC}"
mkdir -p ./public/assets/file-icons/
cp -r ./vscode-material-icon-theme/icons/* ./public/assets/file-icons/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Successfully copied icons${NC}"
else
    echo -e "${RED}Failed to copy icons${NC}"
    exit 1
fi

# Copy and convert fileIcons.ts
echo -e "${YELLOW}Processing fileIcons.ts...${NC}"

# Ensure the FileIcon directory exists
mkdir -p ./lib/components/atoms/FileIcon/

# Copy the original fileIcons.ts
cp ./vscode-material-icon-theme/src/core/icons/fileIcons.ts ./lib/components/atoms/FileIcon/fileIcons.ts

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to copy fileIcons.ts${NC}"
    exit 1
fi

echo -e "${GREEN}Successfully copied fileIcons.ts${NC}"

# Convert TypeScript to JSON
echo -e "${YELLOW}Converting fileIcons.ts to JSON format...${NC}"

# Create a temporary file for processing
TEMP_FILE="./lib/components/atoms/FileIcon/fileIcons.temp.ts"

# First, let's create a Node.js script to properly extract and convert the data
cat > convert_icons.cjs << 'EOF'
const fs = require('fs');

// Read the original file
const content = fs.readFileSync('./vscode-material-icon-theme/src/core/icons/fileIcons.ts', 'utf8');

// Simple regex-based extraction since we need to avoid complex TypeScript parsing
// Extract the data array from parseByPattern call
const parseByPatternMatch = content.match(/parseByPattern\(\[[\s\S]*?\]\)/);

if (!parseByPatternMatch) {
    console.error('Could not find parseByPattern array');
    process.exit(1);
}

// Extract just the array content (without parseByPattern wrapper)
let arrayContent = parseByPatternMatch[0].replace(/parseByPattern\(/, '').replace(/\)$/, '');

// Remove enabledFor properties since they're not needed
arrayContent = arrayContent.replace(/,?\s*enabledFor:\s*\[[^\]]*\]/g, '');

// Remove patterns properties since they're not needed
arrayContent = arrayContent.replace(/,?\s*patterns:\s*\{[^}]*\}/g, '');

// Clean up any trailing commas that might be left after removing properties
arrayContent = arrayContent.replace(/,(\s*[}\]])/g, '$1');

// Create the final JSON-like object structure
const result = `// Generated from vscode-material-icon-theme
// This file contains file icon mappings converted from TypeScript to JavaScript object
export const fileIcons = {
  defaultIcon: { name: 'file' },
  icons: ${arrayContent}
};`;

// Write the result
fs.writeFileSync('./lib/components/atoms/FileIcon/fileIcons.ts', result);
console.log('Successfully converted fileIcons.ts');
EOF

# Run the conversion script
node convert_icons.cjs

# Clean up the conversion script
rm convert_icons.cjs

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Successfully converted fileIcons.ts to JSON format${NC}"
else
    echo -e "${RED}Failed to convert fileIcons.ts${NC}"
    exit 1
fi

# Clean up
echo -e "${YELLOW}Cleaning up temporary files...${NC}"
rm -rf ./vscode-material-icon-theme

echo -e "${GREEN}✅ All done! Files updated:${NC}"
echo -e "  📁 ./lib/assets/file-icons/ - Icon files"
echo -e "  📄 ./lib/components/atoms/FileIcon/fileIcons.ts - File icons configuration"