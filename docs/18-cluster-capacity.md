---
sidebar_position: 18
---

# Cluster Capacity

For admins: how much room the Kubernetes clusters have left: the one Forge
runs on (`production`) and the other clusters it knows (`aks-production`, the
AKS cluster). You see their nodes, whether each one is healthy, how much of
their CPU, memory and disk is in use right now, and how full every persistent
volume is. Other members get `only an admin may` (exit code 5).

## Common Questions

```sh
# Are the clusters healthy, and how full are they?
forge cluster list

# Which node is the problem?
forge cluster get production
forge cluster get aks-production

# Every node that is not Ready, for a script
forge cluster get production -o json | jq '.nodes[] | select(.condition != "Ready")'

# Which volumes are more than 80% full?
forge cluster get production -o json | jq -r '.volumes[] | select((.usedBytes|tonumber) > 0.8 * (.capacityBytes|tonumber)) | "\(.namespace)/\(.claim)"'

# May I see it?
forge auth can cluster.read
```

`forge cluster list` prints one row per cluster:

```text
NAME             STATUS                      CPU   MEMORY   DISK   NODES   KUBERNETES
production       Memory pressure on 1 node   29%   42%      32%    5       v1.37.0+k3s1
aks-production   Healthy                     7%    32%      -      2       v1.36.4
```

Disk and volumes come from the Prometheus of the cluster Forge runs on, so
other clusters show none (`-`).

`forge cluster get` adds the totals, one row per node and one per volume,
fullest first:

```text
NODE       ROLES                CONDITION        SCHEDULABLE   CPU              MEMORY            DISK               PODS
node-a     worker               Ready            yes           31% of 8 cores   25% of 16.0 GiB   10% of 200.0 GiB   2/110
node-b     control-plane,etcd   Ready            yes           25% of 4 cores   75% of 8.0 GiB    75% of 100.0 GiB   1/110
node-c     worker               MemoryPressure   no            13% of 4 cores   88% of 8.0 GiB    90% of 50.0 GiB    1/110

VOLUME                     SERVICE    ENV          USED
payments-production/data   payments   production   90% of 10.0 GiB
monitoring/prometheus-db   -          -            40% of 50.0 GiB
```

## Reading the Figures

| Column | Meaning |
| --- | --- |
| Status | The worst problem: a node that is not ready, then a node under memory, disk or PID pressure, then the fullest of CPU, memory, disk or a volume at 80% or more. Otherwise `Healthy` |
| CPU, Memory | In use now (from metrics-server) out of what the nodes can give to pods |
| Disk | The node's root filesystem: in use out of its size (from Prometheus) |
| Pods | Pods on the node that have not finished, out of the most it takes |
| Schedulable | `no` when the node is cordoned and takes no new pods |
| Volume, Service, Env | A persistent volume claim (`namespace/claim`), and the Forge service and environment it belongs to, or `-` |

The cluster's CPU, memory, disk and pods are summed over the nodes that take
new pods: a cordoned or not-ready node is listed but not counted. The figures
are at most 30 seconds old.

If the output says **No usage figures: metrics-server did not answer**, the
nodes and their conditions are still right; only the percentages are missing.
**No disk or volume figures** means the same for Prometheus: it is not
configured on this Forge, or it did not answer.

## When a Cluster Says "Unavailable"

Forge could not read that cluster. The list shows it with the status
`Unavailable` and no figures, and prints why under the table, for example:

```text
aks-production: cluster aks-production did not answer when asked for its nodes; try again in a moment
```

The other clusters are still shown. Forge tries again after 30 seconds.
`forge cluster get` on that cluster fails with the same reason. If it does not
pass, tell the platform team: the cluster may be down, or the credential Forge
uses for it (Argo CD's) may have changed.

## In the Dashboard

Admins see **Clusters** in the sidebar, under Run. The page lists the clusters
with their status and a CPU and a memory bar; a bar turns amber from 80% used
and red from 90%. A cluster Forge could not read says **Unavailable** with the
reason. Select a cluster's name for its pods and every node, and **Open in
Grafana** for the graphs over time. Others do not see the link.

## When It Says "not configured"

`cluster capacity is not configured on this Forge API (--clusters)` means the
Forge you are talking to does not have the feature switched on. Ask the
platform team. If you run your own Forge, start forge-api with `--clusters`
(`FORGE_CLUSTERS=1`) and give its service account `list` on nodes, pods and
`metrics.k8s.io` nodes. `--cluster-name` names the cluster (default `default`),
and `--grafana-url` adds a link to Grafana. `--prometheus-url` (for example
`http://prometheus.monitoring.svc:9090`) adds disks and volumes; forge-api then
also needs `list` on namespaces, to tie volumes to services.

To show other clusters that Argo CD already manages, name their Argo CD cluster
Secrets (in namespace `argocd`) in `--remote-clusters`
(`FORGE_REMOTE_CLUSTERS=aks-production`), and let forge-api `get` exactly
those Secrets. Each Secret's name is the cluster's name in Forge, so it must be
lowercase letters, digits and `-`, at most 40 characters. Forge reads the
cluster with the credential in the Secret: a bearer token or client
certificate over verified TLS. It refuses Secrets that log in with an exec
plugin, a cloud login or a password, or that skip TLS verification.
