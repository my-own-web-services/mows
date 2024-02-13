#!/bin/bash

sudo virsh destroy test-machine

sudo virsh undefine test-machine

sudo virsh vol-delete --pool default "test-machine-primary.qcow2"