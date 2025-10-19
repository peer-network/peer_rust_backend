
use tracing_subscriber::{
    layer::SubscriberExt, 
    util::SubscriberInitExt, 
    EnvFilter, 
    fmt,
};
use tracing_appender::{non_blocking, rolling};
use std::path::Path;
use chrono::Utc;
use std::sync::{Arc, Mutex, OnceLock};

static GUARD_STORAGE: OnceLock<Arc<Mutex<Option<non_blocking::WorkerGuard>>>> = OnceLock::new();

pub fn initialize_production_logging(app_name: &str) -> Result<(), Box<dyn std::error::Error>> {
    let logs_dir = "logs";
    if !Path::new(logs_dir).exists() {
        std::fs::create_dir_all(logs_dir)?;
    }
    
    let date = Utc::now().format("%Y-%m-%d");
    let log_filename = format!("{}-{}.log", app_name, date);
    
    let file_appender = rolling::never(logs_dir, &log_filename);
    let (file_writer, file_guard) = non_blocking(file_appender);
    
    let guard_storage = GUARD_STORAGE.get_or_init(|| Arc::new(Mutex::new(None)));
    *guard_storage.lock().unwrap() = Some(file_guard);
    
    let log_level = std::env::var("RUST_LOG")
        .unwrap_or_else(|_| "debug".to_string());
    
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| {
            format!("peer_token_cli={},peer_common={},peer_server={}", 
                log_level, log_level, log_level).into()
        });
    
    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            fmt::layer()
                .with_writer(file_writer)
                .with_ansi(false)
                .with_target(true)
                .with_thread_ids(true)
                .with_file(true)
                .with_line_number(true)
        )
        .try_init()
        .map_err(|e| format!("Failed to initialize tracing: {}", e))?;
    
    println!(" Logging to: {}/{}", logs_dir, log_filename);
    println!(" Log level: {}", log_level);
    
    tracing::info!(
        app_name = app_name,
        log_level = %log_level,
        log_file = format!("{}/{}", logs_dir, log_filename),
        " Logging system initialized"
    );
    
    Ok(())
}

