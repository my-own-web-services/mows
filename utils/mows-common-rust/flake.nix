{
  description = "Mozart - Docker Compose label utilities and template rendering";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rust-analyzer" ];
        };

        # Build dependencies
        nativeBuildInputs = with pkgs; [
          rustToolchain
          pkg-config
        ];

        buildInputs = with pkgs; [
          openssl
        ] ++ lib.optionals stdenv.isDarwin [
          darwin.apple_sdk.frameworks.Security
          darwin.apple_sdk.frameworks.SystemConfiguration
        ];

      in
      {
        packages = {
          default = self.packages.${system}.mozart;

          mozart = pkgs.rustPlatform.buildRustPackage {
            pname = "mozart";
            version = "0.1.0";

            # Use the workspace root as source
            src = ./../..;

            cargoLock = {
              lockFile = ./../../Cargo.lock;
              outputHashes = {
                "serde_yaml_ng-0.10.0" = "sha256-i0hpKVaG1UM/J8EW9pWlf6xfqw2cFXug/OgIZEocQUw=";
              };
            };

            inherit nativeBuildInputs buildInputs;

            # Build from workspace root
            buildAndTestSubdir = "utils/mows-common-rust";

            # Only build the CLI binary
            cargoBuildFlags = [ "--bin" "mozart" ];

            # Run tests
            doCheck = true;
            cargoTestFlags = [ "--bin" "mozart" ];

            meta = with pkgs.lib; {
              description = "Mozart - Docker Compose label utilities and template rendering";
              homepage = "https://github.com/yourusername/mows";
              license = licenses.mit;
              maintainers = [ ];
              mainProgram = "mozart";
            };
          };
        };

        # Development shell
        devShells.default = pkgs.mkShell {
          inherit buildInputs;
          nativeBuildInputs = nativeBuildInputs ++ (with pkgs; [
            cargo-watch
            cargo-edit
            rust-analyzer
          ]);

          RUST_SRC_PATH = "${rustToolchain}/lib/rustlib/src/rust/library";

          shellHook = ''
            echo "Mozart development environment"
            echo "Run 'cargo build --bin mozart' to build"
            echo "Run 'cargo test' to run tests"
            echo "Run 'cargo run --bin mozart -- --help' to see CLI help"
          '';
        };

        # Apps for easy running
        apps.default = {
          type = "app";
          program = "${self.packages.${system}.mozart}/bin/mozart";
        };
      }
    );
}
