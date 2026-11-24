/// Opens the system print dialog for the sheet. On macOS the web view cannot do this itself
/// (window.print() does nothing there), so the front end calls this command instead.
#[tauri::command]
fn print_sheet(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![print_sheet])
        .run(tauri::generate_context!())
        .expect("error while running the app");
}
