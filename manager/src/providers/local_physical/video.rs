// list all /dev/video* devices
// get the info for the devices with `udevadm info --name=/dev/video* --json=short`
// filter them and keep the ones that have ID_SERIAL=MACROSILICON_USB_Video
// start the ustreamer server for each of the devices: ustreamer -d /dev/video* --host=0.0.0.0 --port=1000* -q 90 -r 1280x720 --drop-same-frames=120
// now for the tricky part: we need to attach the correct stream to the correct machine
