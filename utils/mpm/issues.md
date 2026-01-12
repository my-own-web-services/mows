# tab lines

# brighter colors

# suggestions

# file linting based on schema

# warning for empty variables

# template before and after render line comparison side by side

# true and := coloring

ensure that the application can be used on different systems and architectures with all its features, create a comprehensive plan what is needed to do that

when the cli is run it should check in the background without delaying the execution if there is a new version available, it should then write that to its config file and next time its run it should tell the user that there is a new version available

# there should be also a fine taste agent that checks for things that i would never allow to have been programmed in the first place

- Don't just create hacks or workarounds to solve a problem even if they work, you should always use the canonical approach to solve a problem, always do some research first if you are not 100% sure

- when creating any kind of application they should almost always be statically linked and have not external dependencies, for example when some file should be downloaded from the web by an app this should always be done with native application code and not through the use of a spanned child process curl command

- when checking paths, validating urls, parsing json etc. always use the canonical rust libraries that everyone uses, don't just roll it yourself, use the native path module for working with paths, the url crate for urls, serde_json for json and so on

- when using crates ensure that they have a proper userbase and that you are using the last version have in mind that you will need to search the web for the latest version or cargo add it because of your knowledge cutoff

- after publishing a new version check if the pipeline building it actually passes and fix any error that may arise

- when trying to commit or push, the ssh key might not be injected to allow this, prompt me to unlock my password manager so that the ssh key gets injected and the commit can be signed and pushed

- Never advertise for yourself in git commits or anywhere else

- this system is using nixos

# there should be one agent that verifies that the documentation is up to date with the implementation, that it is understandable and organized

# there should be one repository agent that verifies that files are well organized in directories and that overall structure is logical, it should also verify that the code is maintainable and has no duplicate code
