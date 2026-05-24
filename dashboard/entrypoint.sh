#!/bin/sh
set -e
envsubst '${CF_ACCESS_SECRET}' \
    < /etc/nginx/conf.d/default.conf.template \
    > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
