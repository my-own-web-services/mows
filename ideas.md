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

option 1 does also not require another and or branch filter like this when listing files

```rs
doc! {
    "$or": [
        {
            "owner_id": requesting_user_id
        },
        {
            "permission_ids": {
                "$in": file_permissions
            }
        }
    ]
}
```

as we check the group before to check that it has the correct permissions we can just filter for the groupId as we do anyway when listing all files of a certain groupId, this will probably much faster

we could also attach the permission to both resources!
this would be faster in the file group list situation and would not mess up the rest of the auth checking, but we would have the other downsides of both methods 1: its a bit messy, 2: we need to update a whole lot more

as i want to have great performance when listing files even for very large lists it would probably be good to do both

Application workload:

```yaml
files:
    methods:
        list: 10/10
        get: 2/10
        getDerivates: 10/10
        getInfos: 10/10
        updateMetadata: 5/10
        updatePermissions: 1/10
fileGroups:
    methods:
        list: 10/10
        getInfos: 10/10
user:
    methods:
        get: 10/10
```

```yaml
file:
    owner_id: paul
    permissions:
        list:
            users: ["hubert"]
            userGroups: []
            appIds: ["exampleApp"]
        get:
```

use objectId instead of custom id this will make everything a lot faster

for listing (the primary problem)
to list the documents a user has access to we only need the user with their \_id and membership in usergroups
now we can filter for the documents for (permissions.list.users OR permissions.list.userGroups OR owner_id) AND the fileGroupId (AND if the appId is different than the default origin it must be in appIds) we could spare one or when including the owner_id in all users fields

adding app_ids likes this would make it impossible to give different users the ability to use the permission in different apps like this:
The owner wants to be able to list the file in exampleApp and as always possible in the default file manager
the owner wants to be able to restrict huberts access to only list the file in the default file manager but not exampleApp

this would make this possible but could result in a lot of duplication when the same users have access to the same action for different apps
this also would be difficult to index for all the different fields

when listing and also for other actions we know the following:
appId, userId, userGroupIds, permissionKind,

maybe easier to check the permission beforehand and then filter just for the permissionIds like we do now...

```yaml
file:
    owner_id: paul
    permissions:
        list:
            default:
                users: ["hubert"]
                userGroups: []
            exampleApp:
                users: ["hubert"]
                userGroups: []
        get:
```

file group should contain
file members

```yaml
permission:
    owner_id: paul
    actions:
        list:
            exampleApp:
                users: ["hubert"]
                userGroups: []
        get:
```

permissions looking like these and a 1:1 permission:file relation
this way we can search the small space of permissions for the ones matching the request and then filter for all files containing this permission
inherited permissions from groups when filtering could then also save the extra permissionId lookup on the file because we filter for the groupId most of the time. finally including the owner id in the permission could save OR lookup between permission id and owner_id
this is only efficient if we assume that there are not that many different permissions for the files (at worst there is one different permission for each file). i also think it would be difficult to update the permissions without just creating new ones each time (then ending up with one distinct permission per file)

the example below would require less different indexes

```yaml
file:
    owner_id: paul
    permission:
        list:
            users: ["hubert:exampleApp"]
            userGroups: []

        get:
```

when the share receiver wanted to open the file in a different app not accounted for by the shareGiver they would need to ask the shareGiver to change the files permissions for them for each app they want to use the file in.

we could create a "new" file with the same underlying physical data owned by the share receiver then we would bypass permissions completely and could just filter for the owner id to list all files owned by the user, like stated somewhere above the cloning of the fileDocument would be necessary anyway when editing metadata.
this whole thing ends up in a mathematical problem as everything does eventually
how could the requirements be modelled to get to a solution?

```yaml
file:
    owner_id: paul
    permissions:
        list:
            users: ["hubert"]
            userGroups: []
            apps: ["main"]
        get:
```

```yaml
fileGroup:
    owner_id: paul
    permissions:
        fileList:
            users: ["hubert"]
            userGroups: []
            apps: ["main"]
        get:
```

list files request: fileGroupId -> db:fileGroup -> check if matches permission for request -> list files

get files request: fileId -> db:file -> check if permissions match for request -> if yes return files if not -> get files groups -> check if their permissions match -> return files

update file group permission: just update it

now for the tricky part:
update file permission to share it: add it to a all shared files filegroup of every party it is shared with
or dont even make it possible to share a file at its own but just in a filegroup
for sharing with other users this shouldnt be a problem having a file group with all shared files with that user
for "sharing" with an application this shouldnt be a problem either: one general file group per application
this also helps with visibility what is shared with whom

clone files when a share recipient wants to update their metadata?
dynamic groups prevent the updating of metadata from other parties because of security/unwanted behaviour concerns
so either disable dynamic groups completely or have non updateable metadata with a possible proposed metadata changes field
or check for every metadata change if it affects any dynamic groups of the share giver and disallow it as well as for every change to the dynamic group rules of a dynamic group notify the filegroup owner that this could include files because of metdata changes they havent even seen
