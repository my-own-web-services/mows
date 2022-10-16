sync direction
replicate
sync etc

files tagged group:client:syncid
maybe dont use digest but last changed date
folder path is stored in some field

if file name differs but digest is same rename file on server

if file name is same but digest differs update content of file
increase version label

if filename does not exist create new file

if netiher filename nor content could be found delete the file on the server

# Tauri + Preact + Typescript

This template should help get you started developing with Tauri, Preact and Typescript in Vite.

## Recommended IDE Setup

-   [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
