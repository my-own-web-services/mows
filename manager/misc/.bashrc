PS1='\[\e[38;5;202;1m\]manager\[\e[0m\]:\[\e[1m\]\w\[\e[0;2m\][$?]\[\e[0;1m\]> \[\e[0m\]'

alias ll='ls -la --color=auto'

export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"

alias k=kubectl
complete -o default -F __start_kubectl k

alias c=clear


source /usr/share/bash-completion/bash_completion
