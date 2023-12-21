permissions:

files:
lesen
updaten
bestimmte metainformationen updaten -> könnte zur folge haben dass die datei z.b. in einer dynamischen gruppe landet ohne dass die drittperson diese kennt -> nur vorschläge die angenommen/abgelehnt werden müssen speichern
löschen

fileGroups:
lesen

    meta updaten -> könnte dazu führen dass der selektor einer dynamischen gruppe geändert wird und sie auf einmal dateien inkludiert auf die der drittnutzer keinen zugriff haben sollte

user:
approve user invitation kann nur der admin delegieren

usergroup:
add user
remove user
change name

Szenario 1: teilen von fotos mit anna
erstellen einer dynamischen gruppe mit filter der alle fotos inkludiert die geteilt werden sollen
teilen der dynamischen gruppe zum lesen
Anna kann dateien listen und lesen
sie möchte ein subset davon mit jemand anderem teilen
sie kann die tags nicht bearbeiten
sie kann eine statische gruppe erstellen die dateien dazu hinzufügen -> hätte zur folge dass ihre gruppe in der liste von gruppen der datei auftaucht die dann ich auch wieder sehen könnte
also kopie des datei dokuments mit gleicher physisch unterliegenden datei
dann kann sie die metadaten updaten wie sie will ohne dass diese auf dem original dokument geändert werden
wenn sie löschen oder updaten kann dann kann sie die original datei löschen oder bearbeiten
sie kann auch ohne permissions ihre kopie bearbeiten dann wird der unterliegende physische speicher geklont
wenn der original nutzer die datei löscht ist ihre datei auch weg außer wenn sie geklont wurde

problem: gemeinsames bearbeiten von metadaten nicht möglich

ihre änderungen könnten als vorgeschlagene änderungen bei mir angezeigt werden
und meine bei ihr wir beide können dann manuell entscheiden ob wie diese übernehmen wollen
man könnte sie auch automatisch übernehmen wenn man vorher checkt ob das zu irgendwelchen änderungen in den dynamischen gruppen führen würde
durch das automatische mergen bzw. das nicht mögliche mergen könnte man dann aber die anderen dynamischen gruppen/regeln einer anderen person herausfinden

list file groups:
user
permissions = search for permissions that include userId or userGroupId and are relevant for the list filegroups action
search for file groups that include permissionId in the permissionIds array or userId in the owner field
this way we can be sure that we only fetch the correct documents from the db

same goes for any other listing operation
the other ones are easier because we fetch all requested data anyway and then check permissions locally

list files of file groups:

option 1. file permissions are inherited from the group
user, fileGroupId
fileGroup=get fileGroup
permissions= get filegroup permissions
check if userId or one of the usergroup ids is present in the permission
if yes list the files of the group like it was the owner

option 2. file permissions are set on each file and not inherited from the group that means to share a group two permissions need to be created one for the files and one for the group

user, filegroupid
relevant permissions = search for permissions that include userid or usergroup id and are relevant for the list files action
list all files matching the filegroupid and include the permission ids or are owned by the user

list all files the user has access to:
option 1. file permissions are inherited from the group
user
permissions = search for permissions that include userId or userGroupId and are relevant for the list files action with both file and filegroup type
filegroups = search for the filegroups that include the filegroup permissions
filter all files where either the owner_id is the userid OR they have the filegroupid OR they include one of the file permissions

option 2. file permissions are set on each file and not inherited from the group that means to share a group two permissions need to be created one for the files and one for the group
user
permissions=search for permissions that include userId or userGroupId and are relevant for the list files action of type file
filter all files that either have one of the permissions or where the user is the owner

option 2 is the more logical consistent one but when deleting the file group the permission of the files that is related to the file group needs to be pulled too and this relation needs to be accounted for, because expected behaviour would be that when deleting a shared file group that the access to its files is now also denied

with option 2 it would also be possible to create a shared filegroup where every file gets attached its permission and then the permission gets removed from one file but the file stays in the shared group leading to an non requestable file that is still in the shared group
also when the file group is a dynamic file group on every update of the files in it the file permissions of the filegroup would need to be attached to the changed files further complicating this process.
this could be solved through marking the permission as beeing related to another resource an as long as the other exists it cannot be removed

this is why option 1 might be better

option 1 does not integrate well with the current auth function
either make this work or use option 2
