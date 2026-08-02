use sha2::{Digest, Sha256};

/// Returns a short, stable hardware ID for THIS machine, derived from a native
/// machine identifier (motherboard/OS install UUID depending on platform).
/// This never changes across reboots but WILL differ if the app/database is
/// copied to a different PC — that's the anti-copy "node lock".
#[tauri::command]
fn get_hardware_id() -> Result<String, String> {
    let raw = machine_uid::get().map_err(|e| e.to_string())?;

    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let hash = hasher.finalize();

    // Take the first 6 bytes, format as uppercase hex, prefixed for readability.
    let hex: String = hash.iter().take(6).map(|b| format!("{:02X}", b)).collect();
    Ok(format!("SCH-HW-{}", hex))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_hardware_id])
        .run(tauri::generate_context!())
        .expect("error while running school manager application");
}
