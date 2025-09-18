#!/bin/bash

# HTTPS/SSL 設置腳本 (Let's Encrypt)

set -e

echo "🔒 設置 HTTPS (Let's Encrypt)..."

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 設定變數
DOMAIN=""
EMAIL=""

# 檢查 certbot
check_certbot() {
    if ! command -v certbot &> /dev/null; then
        echo -e "${YELLOW}⚠️  Certbot 未安裝，正在安裝...${NC}"
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx
    fi
}

# 取得域名資訊
get_domain_info() {
    echo ""
    read -p "請輸入您的域名 (例如: guardian.hsinchu.gov.tw): " DOMAIN
    read -p "請輸入您的電子郵件 (用於證書通知): " EMAIL

    if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        echo -e "${RED}❌ 域名和電子郵件都是必填的${NC}"
        exit 1
    fi
}

# 生成自簽名證書（開發用）
generate_self_signed() {
    echo "📝 生成自簽名證書（開發測試用）..."

    mkdir -p ../ssl

    # 生成私鑰
    openssl genrsa -out ../ssl/key.pem 2048

    # 生成證書請求
    openssl req -new -key ../ssl/key.pem -out ../ssl/csr.pem \
        -subj "/C=TW/ST=Taiwan/L=Hsinchu/O=Hsinchu City Government/CN=localhost"

    # 生成自簽名證書
    openssl x509 -req -days 365 -in ../ssl/csr.pem -signkey ../ssl/key.pem -out ../ssl/cert.pem

    rm ../ssl/csr.pem

    echo -e "${GREEN}✅ 自簽名證書已生成${NC}"
}

# 使用 Let's Encrypt 取得證書
get_letsencrypt_cert() {
    echo "🔐 使用 Let's Encrypt 取得 SSL 證書..."

    # 停止 nginx（如果運行中）
    sudo systemctl stop nginx 2>/dev/null || true
    docker-compose stop nginx 2>/dev/null || true

    # 取得證書
    sudo certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email $EMAIL \
        -d $DOMAIN

    # 複製證書到專案目錄
    sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ../ssl/cert.pem
    sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ../ssl/key.pem
    sudo chown $USER:$USER ../ssl/*

    echo -e "${GREEN}✅ Let's Encrypt 證書已取得${NC}"
}

# 更新 Nginx 配置
update_nginx_config() {
    echo "📝 更新 Nginx 配置..."

    cat > ../nginx-ssl.conf << EOF
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    gzip on;

    # 上游服務器
    upstream backend_api {
        server backend:3000;
    }

    upstream admin_api {
        server backend:3001;
    }

    # HTTP 重定向到 HTTPS
    server {
        listen 80;
        server_name $DOMAIN;
        return 301 https://\$server_name\$request_uri;
    }

    # HTTPS 配置
    server {
        listen 443 ssl http2;
        server_name $DOMAIN;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # 安全標頭
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        location / {
            root /usr/share/nginx/html;
            try_files \$uri \$uri/ /admin/index.html;
        }

        location /api/ {
            proxy_pass http://admin_api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_cache_bypass \$http_upgrade;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        location /socket.io/ {
            proxy_pass http://admin_api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        location /admin {
            alias /usr/share/nginx/html/admin;
            try_files \$uri \$uri/ /admin/index.html;
        }
    }
}
EOF

    echo -e "${GREEN}✅ Nginx 配置已更新${NC}"
}

# 設置自動更新
setup_auto_renewal() {
    echo "🔄 設置證書自動更新..."

    # 建立更新腳本
    cat > ../scripts/renew-cert.sh << 'EOF'
#!/bin/bash
certbot renew --pre-hook "docker-compose stop nginx" --post-hook "docker-compose start nginx"
EOF

    chmod +x ../scripts/renew-cert.sh

    # 加入 crontab
    (crontab -l 2>/dev/null; echo "0 2 * * 1 /home/ubuntu/dev/hccg-hsinchu-pass-guardian/scripts/renew-cert.sh") | crontab -

    echo -e "${GREEN}✅ 自動更新已設置${NC}"
}

# 主程序
main() {
    echo "======================================"
    echo "    HTTPS/SSL 設置精靈"
    echo "======================================"
    echo ""
    echo "請選擇設置方式："
    echo "1) Let's Encrypt (需要有效域名)"
    echo "2) 自簽名證書 (開發測試用)"
    echo "3) 跳過 (稍後設置)"
    read -p "選擇 (1-3): " choice

    case $choice in
        1)
            check_certbot
            get_domain_info
            get_letsencrypt_cert
            update_nginx_config
            setup_auto_renewal
            echo ""
            echo -e "${GREEN}🎉 HTTPS 設置完成！${NC}"
            echo "請確保您的域名 DNS 已正確指向此伺服器"
            echo "訪問: https://$DOMAIN/admin"
            ;;
        2)
            generate_self_signed
            DOMAIN="localhost"
            update_nginx_config
            echo ""
            echo -e "${GREEN}🎉 自簽名證書設置完成！${NC}"
            echo -e "${YELLOW}⚠️  瀏覽器會顯示安全警告，這是正常的${NC}"
            ;;
        3)
            echo -e "${YELLOW}⚠️  已跳過 HTTPS 設置${NC}"
            ;;
        *)
            echo -e "${RED}無效選擇${NC}"
            exit 1
            ;;
    esac
}

# 執行主程序
main