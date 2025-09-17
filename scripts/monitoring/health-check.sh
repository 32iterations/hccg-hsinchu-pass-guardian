#!/bin/bash
set -euo pipefail

# Health monitoring script
echo "🏥 Hsinchu Pass Guardian - Health Check"

# Configuration
SERVICE_URL="${SERVICE_URL:-http://localhost:3000}"
ALERT_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
CHECK_INTERVAL="${CHECK_INTERVAL:-60}"
MAX_RETRIES=3

# Health endpoints to check
declare -a ENDPOINTS=(
    "/health"
    "/api/health"
    "/api/safety/status"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging
log_info() { echo -e "${GREEN}✅${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠️${NC} $1"; }
log_error() { echo -e "${RED}❌${NC} $1"; }

# Check single endpoint
check_endpoint() {
    local endpoint=$1
    local url="${SERVICE_URL}${endpoint}"
    local retry=0

    while [ $retry -lt $MAX_RETRIES ]; do
        if response=$(curl -sf -w "\n%{http_code}" "$url" 2>/dev/null); then
            http_code=$(echo "$response" | tail -1)
            body=$(echo "$response" | head -n -1)

            if [ "$http_code" -eq 200 ]; then
                log_info "$endpoint is healthy (HTTP $http_code)"
                return 0
            else
                log_warn "$endpoint returned HTTP $http_code"
            fi
        else
            log_error "$endpoint is unreachable (attempt $((retry+1))/$MAX_RETRIES)"
        fi

        retry=$((retry+1))
        [ $retry -lt $MAX_RETRIES ] && sleep 5
    done

    return 1
}

# Check database connection
check_database() {
    log_info "Checking database connection..."

    # PostgreSQL check (adjust for your database)
    if command -v pg_isready &> /dev/null; then
        if pg_isready -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" &> /dev/null; then
            log_info "Database is responding"
        else
            log_error "Database is not responding"
            return 1
        fi
    fi

    # Redis check
    if command -v redis-cli &> /dev/null; then
        if redis-cli -h "${REDIS_HOST:-localhost}" ping &> /dev/null; then
            log_info "Redis is responding"
        else
            log_warn "Redis is not responding"
        fi
    fi

    return 0
}

# Check system resources
check_resources() {
    log_info "Checking system resources..."

    # Memory check
    mem_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    if (( $(echo "$mem_usage > 90" | bc -l) )); then
        log_error "High memory usage: ${mem_usage}%"
    else
        log_info "Memory usage: ${mem_usage}%"
    fi

    # Disk check
    disk_usage=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        log_error "High disk usage: ${disk_usage}%"
    else
        log_info "Disk usage: ${disk_usage}%"
    fi

    # CPU load
    load_avg=$(uptime | awk -F'load average:' '{print $2}')
    log_info "Load average:${load_avg}"
}

# Check service processes
check_processes() {
    log_info "Checking service processes..."

    # Check Node.js processes
    if pgrep -f "node.*backend" > /dev/null; then
        log_info "Backend service is running"
    else
        log_error "Backend service is not running"
    fi

    # Check Docker containers (if using Docker)
    if command -v docker &> /dev/null; then
        running_containers=$(docker ps --format "table {{.Names}}\t{{.Status}}" | tail -n +2)
        if [ -n "$running_containers" ]; then
            log_info "Docker containers:"
            echo "$running_containers"
        fi
    fi
}

# Send alert
send_alert() {
    local message=$1
    local severity=${2:-warning}

    if [ -n "$ALERT_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Health Check Alert (${severity}): ${message}\"}" \
            "$ALERT_WEBHOOK" 2>/dev/null
    fi

    # Log to file
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ${severity}: ${message}" >> health-check.log
}

# Generate health report
generate_report() {
    cat > health-report.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "status": "$1",
  "checks": {
    "endpoints": $2,
    "database": $3,
    "resources": $4,
    "processes": $5
  },
  "uptime": "$(uptime -p)",
  "service_url": "${SERVICE_URL}"
}
EOF
}

# Main health check
main() {
    echo "========================================="
    echo "Starting health check at $(date)"
    echo "Service URL: ${SERVICE_URL}"
    echo "========================================="

    local overall_status="healthy"
    local endpoint_status=true
    local db_status=true
    local resource_status=true
    local process_status=true

    # Check all endpoints
    for endpoint in "${ENDPOINTS[@]}"; do
        if ! check_endpoint "$endpoint"; then
            endpoint_status=false
            overall_status="unhealthy"
        fi
    done

    # Check database
    if ! check_database; then
        db_status=false
        overall_status="degraded"
    fi

    # Check resources
    check_resources

    # Check processes
    if ! check_processes; then
        process_status=false
        overall_status="unhealthy"
    fi

    # Generate report
    generate_report "$overall_status" "$endpoint_status" "$db_status" "$resource_status" "$process_status"

    # Send alerts if unhealthy
    if [ "$overall_status" != "healthy" ]; then
        send_alert "Service is ${overall_status}!" "critical"
    fi

    echo "========================================="
    if [ "$overall_status" == "healthy" ]; then
        log_info "Overall status: HEALTHY ✅"
    elif [ "$overall_status" == "degraded" ]; then
        log_warn "Overall status: DEGRADED ⚠️"
    else
        log_error "Overall status: UNHEALTHY ❌"
    fi
    echo "========================================="

    # Exit code based on status
    [ "$overall_status" == "healthy" ] && exit 0 || exit 1
}

# Continuous monitoring mode
if [ "${1:-}" == "--monitor" ]; then
    log_info "Starting continuous monitoring (interval: ${CHECK_INTERVAL}s)"
    while true; do
        main
        sleep "$CHECK_INTERVAL"
    done
else
    main
fi