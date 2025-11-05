{
  description = "MOWS CLI tool";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    crane = {
      url = "github:ipetkov/crane";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay, crane }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rust-analyzer" ];
        };

        craneLib = (crane.mkLib pkgs).overrideToolchain rustToolchain;

        # Common build inputs needed for the project
        commonBuildInputs = with pkgs; [
          openssl
          pkg-config
        ];

        # Build the workspace
        mows-workspace = craneLib.buildPackage {
          src = craneLib.cleanCargoSource ./.;

          buildInputs = commonBuildInputs;

          nativeBuildInputs = with pkgs; [
            pkg-config
          ];

          # Ensure we only build the mows binary
          cargoExtraArgs = "--bin mows";

          meta = with pkgs.lib; {
            description = "MOWS CLI tool for template rendering and utilities";
            homepage = "https://github.com/yourusername/mows";
            license = licenses.mit; # Adjust as needed
            maintainers = [ ];
          };
        };

      in
      {
        packages = {
          default = mows-workspace;
          mows = mows-workspace;
        };

        apps = {
          default = flake-utils.lib.mkApp {
            drv = mows-workspace;
            exePath = "/bin/mows";
          };
          mows = flake-utils.lib.mkApp {
            drv = mows-workspace;
            exePath = "/bin/mows";
          };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = commonBuildInputs ++ [
            rustToolchain
            pkgs.cargo-watch
            pkgs.cargo-edit
          ];

          RUST_SRC_PATH = "${rustToolchain}/lib/rustlib/src/rust/library";
        };
      }
    );
}
