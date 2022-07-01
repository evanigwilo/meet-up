## Folder for any locally-trusted development certificates

>[Mkcert](https://github.com/FiloSottile/mkcert) command to generate locally-trusted self-signed development certificates for localhost

```bash
mkcert -key-file ./certkeys/localhost.key -cert-file ./certkeys/localhost.crt localhost
```