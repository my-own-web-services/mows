autoload -Uz compinit
compinit
alias k=kubectl
source <(kubectl completion zsh)
source <(cilium completion zsh)
source <(helm completion zsh)
compdef k='kubectl'
autoload -U promptinit && promptinit


PROMPT="%B%F{202}manager%f%b%B:%b%B%d%b%F{7}[%f%F{7}%?%f%F{7}]%f>"
