check if sync operation exists

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
