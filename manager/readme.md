-   forward the libvirtd socket to the container
-   use a debian docker image or similar
-   use virt-install and virsh to manage the machines

--

-   paste config or create new cluster

`chmod 600 ~/.ssh/id ; ssh kairos@192.168.122.99 -o Preferredauthentications=publickey -i ~/.ssh/mows-GmpdECeoy6vfkrgsGB4ZfpeZSsKmprivate`

echo "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABDNys/SMK
tkGLIgCzEXAth4AAAAEAAAAAEAAAAzAAAAC3NzaC1lZDI1NTE5AAAAIGaJKkes1QCBwIm+
VPC2dAGWcnxJKty87R2uzPEVwU94AAAAoMa6sS+3sTVI3qIemv/iqRNmX7NUfbyQr0gR15
YZrCBLmjt7oBxH/9F+RG9PM9uerQSOqIeMPgD0K1+CXGZFphGhXYL8eSF+U/eNPokChwjj
AT+M1ZysT7ChGdzTZ1MmqNKPR+9wCilk93qVvaT1+b4BFRXi0P3Ym2Mn9N1K8PkQRho53Q
ZiE+ERUMPWZGmQTGyCu9CqPPe9Yghon0UWml8=
-----END OPENSSH PRIVATE KEY-----" > ~/.ssh/id
