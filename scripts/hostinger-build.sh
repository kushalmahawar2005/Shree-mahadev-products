#!/bin/bash
# Build the working tree as a Hostinger-ready standalone zip (no secrets inside).
set -e
R="$(cd "$(dirname "$0")/.." && pwd)"
SP="${DEPLOY_TMP:-/tmp/smp-deploy}"; mkdir -p "$SP"
D=$SP/deploy
cd "$R"
rm -rf $D && mkdir -p $D
# Hostinger runs build:prebuilt on the server with the live env: it applies pending SQL migrations
# (scripts/db-setup.mjs) before the prebuilt .next goes live. A failed migration fails the deploy, so the
# site stays on the previous version.
# Only files git knows about (tracked + new, not ignored): keeps .next-qa, output/, tmp/ etc. out.
git ls-files -co --exclude-standard | grep -v -E '^(public/videos/|tmp/|output/|\.env)' | rsync -a --files-from=- ./ $D/
cd $D
echo "node-linker=hoisted" > .npmrc
grep -q 'output: "standalone"' next.config.ts || perl -0pi -e 's/(const nextConfig: NextConfig = \{\n)/$1  output: "standalone",\n/' next.config.ts
pnpm install --frozen-lockfile --prefer-offline >/dev/null 2>&1
cp "$R/.env.local" .env.local
trap 'rm -f "$D/.env.local"' EXIT
# NEXT_PUBLIC_* values are baked into the browser bundle at build time (the live hPanel values are NOT
# used for these). Print them so a local-only value (localhost URL, test number) is caught before deploy.
echo "Baked public values:"; grep -E '^NEXT_PUBLIC_' .env.local | grep -v '^NEXT_PUBLIC_SITE_URL=' | sed 's/^/  /'
echo "  NEXT_PUBLIC_SITE_URL=https://swadeshimahadevproducts.in (forced)"
if grep -E '^NEXT_PUBLIC_' .env.local | grep -v '^NEXT_PUBLIC_SITE_URL=' | grep -qE '(localhost|127\.0\.0\.1|ngrok|trycloudflare)'; then echo "A NEXT_PUBLIC_ value points at a local/tunnel host. Fix .env.local first."; exit 1; fi
# public/ images are served from their Cloudinary mirror (image-loader.ts): sync new/changed ones first.
node scripts/upload-static.mjs > /tmp/smp-static-sync.log 2>&1 || { cat /tmp/smp-static-sync.log; echo "static image sync failed"; exit 1; }
tail -1 /tmp/smp-static-sync.log
NEXT_PUBLIC_SITE_URL=https://swadeshimahadevproducts.in pnpm build 2>&1 | grep -E "rror|✓ Compiled|✓ Generating"
rm -f .env.local
# Hostinger rebuilds on its own (e.g. after saving env vars in hPanel) with its stored "build" command,
# and `next build` hangs on that server. So in the uploaded package BOTH scripts only apply migrations;
# the app itself is the prebuilt .next below. (Staging copy only: the repo's package.json is unchanged.)
node -e 'const f="package.json",p=JSON.parse(require("fs").readFileSync(f));p.scripts["build"]=p.scripts["build:prebuilt"]="node scripts/db-setup.mjs";require("fs").writeFileSync(f,JSON.stringify(p,null,2)+"\n")'
S=.next/standalone
for l in $(cd $S && find . -type l); do t=$(cd "$S/$(dirname $l)" && cd "$(readlink $(basename $l))" && pwd); rm "$S/$l"; cp -R "$t" "$S/$l"; done
rm -rf $S/node_modules/@img/sharp-*darwin* 
cp -R public $S/public
cp -R .next/static $S/.next/static
test -z "$(find $S -type l)"
for k in DATABASE_PASSWORD PAYU_SALT CLOUDINARY_API_SECRET ADMIN_SESSION_SECRET; do v=$(grep "^$k=" "$R/.env.local"|cut -d= -f2-); [ -n "$v" ] && ! grep -rqF "$v" .next || { echo "SECRET LEAK $k"; exit 1; }; done
rm -rf node_modules .next/cache
rm -f $SP/smp-deploy.zip
zip -qr $SP/smp-deploy.zip . -x ".env*"
ls -lh $SP/smp-deploy.zip | awk '{print "zip", $5}'
