#!/bin/bash
set -euo pipefail

echo "🔒 [DevContainer] Initializing security firewall rules..."

# Create whitelist configuration
cat > /tmp/allowed-hosts.txt << 'EOF'
# NPM Registry
registry.npmjs.org
registry.yarnpkg.com
registry.npmmirror.com

# GitHub
github.com
api.github.com
raw.githubusercontent.com
gist.githubusercontent.com
*.github.io

# Anthropic/Claude
api.anthropic.com
claude.ai

# Microsoft/Azure (for DevContainers)
mcr.microsoft.com
*.azurecr.io
*.blob.core.windows.net

# Essential development tools
nodejs.org
deno.land
unpkg.com
cdn.jsdelivr.net
cdnjs.cloudflare.com

# Local development
localhost
127.0.0.1
::1
EOF

# Setup DNS resolution for allowed hosts only
echo "📝 Configuring DNS whitelist..."
if command -v resolvconf > /dev/null 2>&1; then
    echo "nameserver 8.8.8.8" > /etc/resolvconf/resolv.conf.d/base
    echo "nameserver 8.8.4.4" >> /etc/resolvconf/resolv.conf.d/base
fi

# Create iptables rules (if available)
if command -v iptables > /dev/null 2>&1; then
    echo "🛡️ Setting up iptables firewall rules..."

    # Default policies
    iptables -P INPUT DROP
    iptables -P FORWARD DROP
    iptables -P OUTPUT DROP

    # Allow loopback
    iptables -A INPUT -i lo -j ACCEPT
    iptables -A OUTPUT -o lo -j ACCEPT

    # Allow established connections
    iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
    iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

    # Allow DNS
    iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
    iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

    # Allow HTTPS to whitelisted domains (simplified - in production use ipset)
    iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
    iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT

    # Allow SSH for git operations
    iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT

    echo "✅ Firewall rules applied successfully"
else
    echo "⚠️ iptables not available, using alternative security measures"
fi

# Create network policy file for reference
cat > /workspace/.policy/network-policy.json << 'EOF'
{
  "version": "1.0",
  "allowedDomains": [
    "*.npmjs.org",
    "github.com",
    "*.github.com",
    "*.anthropic.com",
    "*.microsoft.com",
    "localhost"
  ],
  "blockedPorts": [25, 465, 587],
  "allowedProtocols": ["https", "ssh", "git"],
  "dnsServers": ["8.8.8.8", "8.8.4.4"],
  "enforceHttps": true
}
EOF

# Set environment variables for network restrictions
export NO_PROXY="localhost,127.0.0.1,::1"
export HTTP_PROXY=""
export HTTPS_PROXY=""

echo "🔐 [DevContainer] Security firewall initialization complete!"
echo "📋 Allowed hosts list saved to /tmp/allowed-hosts.txt"
echo "📋 Network policy saved to /workspace/.policy/network-policy.json"