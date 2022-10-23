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

# merge

update:
remote is newer -> update local
remote is older -> update remote

as neither the filesystem nor filez tells us that a file was deleted
and not just "not downloaded"

example

remote: a.jpg
local: a.jpg
-> they are in sync

local a.jpg gets deleted
remote: a.jpg
local:
-> delete a.jpg on remote

but from the following state
remote: a.jpg
local:
it could also be possible that remote: a.jpg was not synced to local yet
then a.jpg would get deleted on remote because the client sees

so we need to differentiate between not synced and deleted

options are:

to create a diff on the client between the last
sync and the current sync to find out if a file was deleted or not downloaded

this option is better as it does not create more data and load on the db
but this option fails if the file list from the last sync is missing

## or

we store a field on the file that tells the client if it has downloaded it yet

remote: a.jpg - never synced
local:
-> create a.jpg on local

remote: a.jpg - synced
local:
-> delete a.jpg on remote

but same problem exists the other way round

remote deleted the file -> local should delete it too

remote:
local: a.jpg
-> create a.jpg

or

the file did never exist on remote -> local should update it
remote:
local: a.jpg

the state is the same so you cant tell

so either we keep the remote file db entry arround and append
a deleted field to it so that the client can see if it was
deleted and it should delete it too or if it should upload it

the db entry can be fully deleted if all clients have read the delete notice
the clients could mark this by setting a field on the db entry

this prevents us from storing the state on the client
but creates even more state on the db file
