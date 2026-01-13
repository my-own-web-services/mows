# tab lines

# brighter colors

# suggestions

# file linting based on schema

# warning for empty variables

# template before and after render line comparison side by side

# true and := coloring

add a command to the tools section that recreates this
/home/paul/projects/mows/utils/cargo-workspace-docker but way more professional and
less hacked together, no matter where the command is run in a repo it should navigate
up to the cargo workspace root file, when normally run here in mpm for example it
should only update the cargo-workspace-docker.toml in the same folder as executed,
when ran with the flag --all all cargo-workspace-docker.toml files in the repo should
be recreated, this should also fix the issue with the package version, lets plan it
together

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
