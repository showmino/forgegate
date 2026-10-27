---
sidebar_position: 1
---

# Install and Log In

## Install the CLI

Download a release from [GitHub](https://github.com/showmino/forge/releases).
Use the version your Forge runs (`forge version` shows both later):

```sh
# Linux, amd64. Others: linux_arm64, darwin_amd64, darwin_arm64 (.tar.gz),
# windows_amd64 and windows_arm64 (.zip).
VERSION=0.29.0
curl -fLO https://github.com/showmino/forge/releases/download/v$VERSION/forge_${VERSION}_linux_amd64.tar.gz
tar -xzf forge_${VERSION}_linux_amd64.tar.gz forge
install -m 0755 forge ~/.local/bin/forge     # anywhere on your PATH
forge version --client
```

## Point It at Your Forge

The CLI does not know where your Forge is until you tell it. Your Forge's
address is the one of its dashboard:

```sh
forge context set my-org --api https://forge.example.com --use
```

The address is saved in `~/.config/forge/config.yaml`, so you set it once.

## Log In

```sh
forge auth login
```

Forge prints a code and a URL. Open the URL in any browser (it doesn't have to
be on the same machine) and sign in with GitHub. Only members of your
GitHub organization get in.

The login becomes a **Forge session**. You stay logged in until the session
has gone unused for 90 days, you log out, or you leave the organization. The
session is stored in the OS keychain, or in a `0600` file on a Linux machine
without one.

Check who you are and what you may do:

```sh
forge auth status                         # the row "role": admin, or your teams
forge auth status -o json | jq -r '.teams[]'
forge auth can deploy.promote payments    # yes or no, for one action
```

You may change the services of the teams you are in; admins may change
everything. See [Who can do what](index.md#who-can-do-what).

## Check Your Setup

`forge doctor` checks the config, whether the API answers, whether your CLI
and the API are the same version, and whether you are logged in:

```sh
forge doctor
```

## Stay Up to Date

The API serves the CLI of its own version, so you can upgrade without GitHub
access:

```sh
forge upgrade --check   # only say whether there is another version
forge upgrade           # download, verify the checksum, replace the binary
forge version           # client and server version
```

`forge upgrade` needs the HTTPS address of the API. It refuses a plain-HTTP
address.

## Manage Your Sessions

Each `forge auth login` and each browser signed in to the dashboard is a
session.

```sh
forge auth session list                       # all your sessions, newest first
forge auth session revoke ses_4f2a9c1d0b3e5a67 # end one you no longer trust
forge auth logout                             # end this machine's session
```

## Use the API Directly

`forge auth token` prints a valid bearer token, which is useful with `curl`:

```sh
curl -H "Authorization: Bearer $(forge auth token)" \
  -H 'Content-Type: application/json' -d '{}' \
  https://forge.example.com/forge.v1.AuthService/GetStatus
```

Treat the token like a password: never paste it into an issue, a log or a chat.

## Contexts: More Than One Forge

A context names a Forge API, like a kubeconfig context. You need a second one
when you talk to another API, for example a test install or a local forge-api.

```sh
forge context set test --api https://forge.test.example.com
forge context set local --api http://localhost:8080 --use
forge context list
forge context current
forge context use test
forge --context test service list     # one command against another context
FORGE_CONTEXT=test forge service list # the same, from the environment
```

The config is in `~/.config/forge/config.yaml`. It never holds credentials.
Those are kept per API address.

## Shell Completion

```sh
forge completion bash > ~/.local/share/bash-completion/completions/forge
forge completion zsh  > "${fpath[1]}/_forge"
forge completion fish > ~/.config/fish/completions/forge.fish
```
