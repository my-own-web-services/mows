# Scale presets, sourced by seed.sh / bench.sh.
# Choose by setting SCALE=<name> before calling.
# Defined in one place so every script agrees.

set_scale() {
    case "${1:-tiny}" in
        tiny)
            N_USERS=50
            N_APPS=5
            N_USER_GROUPS=10
            N_FILES=1000
            N_FILE_GROUPS=20
            N_PUBLIC_SHARES=50
            N_SERVER_MEMBER_SHARES=100
            N_DIRECT_USER_SHARES=100
            N_DIRECT_GROUP_SHARES=50
            N_RESOURCE_GROUP_SHARES=20
            N_DENY_OVERRIDES=10
            N_OWNED_BY_OWNER=5
            N_ACCESSIBLE_BY_OWNER=5
            ;;
        small)
            N_USERS=500
            N_APPS=10
            N_USER_GROUPS=50
            N_FILES=100000
            N_FILE_GROUPS=200
            N_PUBLIC_SHARES=1000
            N_SERVER_MEMBER_SHARES=5000
            N_DIRECT_USER_SHARES=5000
            N_DIRECT_GROUP_SHARES=2000
            N_RESOURCE_GROUP_SHARES=500
            N_DENY_OVERRIDES=200
            N_OWNED_BY_OWNER=100
            N_ACCESSIBLE_BY_OWNER=50
            ;;
        medium)
            N_USERS=2000
            N_APPS=15
            N_USER_GROUPS=200
            N_FILES=1000000
            N_FILE_GROUPS=2000
            N_PUBLIC_SHARES=100000
            N_SERVER_MEMBER_SHARES=500000
            N_DIRECT_USER_SHARES=50000
            N_DIRECT_GROUP_SHARES=20000
            N_RESOURCE_GROUP_SHARES=5000
            N_DENY_OVERRIDES=2000
            N_OWNED_BY_OWNER=1000
            N_ACCESSIBLE_BY_OWNER=200
            ;;
        target)
            N_USERS=10000
            N_APPS=20
            N_USER_GROUPS=1000
            N_FILES=10000000
            N_FILE_GROUPS=100000
            N_PUBLIC_SHARES=1000000
            N_SERVER_MEMBER_SHARES=5000000
            N_DIRECT_USER_SHARES=500000
            N_DIRECT_GROUP_SHARES=200000
            N_RESOURCE_GROUP_SHARES=50000
            N_DENY_OVERRIDES=20000
            N_OWNED_BY_OWNER=10000
            N_ACCESSIBLE_BY_OWNER=2000
            ;;
        *)
            echo "Unknown scale: $1" >&2
            echo "Choose: tiny | small | medium | target" >&2
            return 1
            ;;
    esac

    export N_USERS N_APPS N_USER_GROUPS N_FILES N_FILE_GROUPS
    export N_PUBLIC_SHARES N_SERVER_MEMBER_SHARES
    export N_DIRECT_USER_SHARES N_DIRECT_GROUP_SHARES
    export N_RESOURCE_GROUP_SHARES N_DENY_OVERRIDES
    export N_OWNED_BY_OWNER N_ACCESSIBLE_BY_OWNER
    export SCALE_NAME="$1"
}
