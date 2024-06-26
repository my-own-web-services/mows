#!/bin/bash
echo "Login Token:"
echo ""

kubectl -n kubernetes-dashboard create token admin-user

echo ""

echo "Dashboard URL:"
echo "http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:https/proxy/"
echo ""

#kubectl proxy