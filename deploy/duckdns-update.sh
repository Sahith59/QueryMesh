#!/bin/bash
# Duck DNS IP updater — runs via cron every 5 minutes
# Replace DUCK_TOKEN and DUCK_DOMAIN before running

DUCK_TOKEN="YOUR_DUCKDNS_TOKEN"
DUCK_DOMAIN="YOUR_SUBDOMAIN"   # just the subdomain, e.g. "querymesh" not "querymesh.duckdns.org"

curl -s "https://www.duckdns.org/update?domains=${DUCK_DOMAIN}&token=${DUCK_TOKEN}&ip=" \
     -o /var/log/duckdns.log
