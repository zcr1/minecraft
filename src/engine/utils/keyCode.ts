export function isKeyCode(code: string): code is KeyCode {
    return VALID_KEY_CODES.has(code as KeyCode);
}

const VALID_KEY_CODES = new Set<KeyCode>([
    "Backquote",
    "Backslash",
    "BracketLeft",
    "BracketRight",
    "Comma",
    "Digit0",
    "Digit1",
    "Digit2",
    "Digit3",
    "Digit4",
    "Digit5",
    "Digit6",
    "Digit7",
    "Digit8",
    "Digit9",
    "Equal",
    "IntlBackslash",
    "IntlRo",
    "IntlYen",
    "KeyA",
    "KeyB",
    "KeyC",
    "KeyD",
    "KeyE",
    "KeyF",
    "KeyG",
    "KeyH",
    "KeyI",
    "KeyJ",
    "KeyK",
    "KeyL",
    "KeyM",
    "KeyN",
    "KeyO",
    "KeyP",
    "KeyQ",
    "KeyR",
    "KeyS",
    "KeyT",
    "KeyU",
    "KeyV",
    "KeyW",
    "KeyX",
    "KeyY",
    "KeyZ",
    "Minus",
    "Period",
    "Quote",
    "Semicolon",
    "Slash",
    "AltLeft",
    "AltRight",
    "Backspace",
    "CapsLock",
    "ContextMenu",
    "ControlLeft",
    "ControlRight",
    "Enter",
    "MetaLeft",
    "MetaRight",
    "ShiftLeft",
    "ShiftRight",
    "Space",
    "Tab",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "End",
    "Home",
    "PageDown",
    "PageUp",
    "Delete",
    "Insert",
    "Escape",
    "PrintScreen",
    "ScrollLock",
    "Pause",
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    "F7",
    "F8",
    "F9",
    "F10",
    "F11",
    "F12",
    "F13",
    "F14",
    "F15",
    "F16",
    "F17",
    "F18",
    "F19",
    "F20",
    "F21",
    "F22",
    "F23",
    "F24",
    "Numpad0",
    "Numpad1",
    "Numpad2",
    "Numpad3",
    "Numpad4",
    "Numpad5",
    "Numpad6",
    "Numpad7",
    "Numpad8",
    "Numpad9",
    "NumpadAdd",
    "NumpadBackspace",
    "NumpadClear",
    "NumpadClearEntry",
    "NumpadComma",
    "NumpadDecimal",
    "NumpadDivide",
    "NumpadEnter",
    "NumpadEqual",
    "NumpadHash",
    "NumpadMemoryAdd",
    "NumpadMemoryClear",
    "NumpadMemoryRecall",
    "NumpadMemoryStore",
    "NumpadMemorySubtract",
    "NumpadMultiply",
    "NumpadParenLeft",
    "NumpadParenRight",
    "NumpadStar",
    "NumpadSubtract",
    "NumLock",
    "AudioVolumeDown",
    "AudioVolumeMute",
    "AudioVolumeUp",
    "MediaPlayPause",
    "MediaSelect",
    "MediaStop",
    "MediaTrackNext",
    "MediaTrackPrevious",
    "BrowserBack",
    "BrowserFavorites",
    "BrowserForward",
    "BrowserHome",
    "BrowserRefresh",
    "BrowserSearch",
    "BrowserStop",
    "Fn",
    "FnLock",
    "Hyper",
    "Power",
    "Sleep",
    "Super",
    "Turbo",
    "Abort",
    "Resume",
    "Suspend",
    "Again",
    "Copy",
    "Cut",
    "Find",
    "Open",
    "Paste",
    "Props",
    "Select",
    "Undo",
    "WakeUp",
    "LaunchApp1",
    "LaunchApp2",
    "LaunchMail",
    "LaunchMediaPlayer",
]);

export type KeyCode =
    // Writing system keys
    | "Backquote"
    | "Backslash"
    | "BracketLeft"
    | "BracketRight"
    | "Comma"
    | "Digit0"
    | "Digit1"
    | "Digit2"
    | "Digit3"
    | "Digit4"
    | "Digit5"
    | "Digit6"
    | "Digit7"
    | "Digit8"
    | "Digit9"
    | "Equal"
    | "IntlBackslash"
    | "IntlRo"
    | "IntlYen"
    | "KeyA"
    | "KeyB"
    | "KeyC"
    | "KeyD"
    | "KeyE"
    | "KeyF"
    | "KeyG"
    | "KeyH"
    | "KeyI"
    | "KeyJ"
    | "KeyK"
    | "KeyL"
    | "KeyM"
    | "KeyN"
    | "KeyO"
    | "KeyP"
    | "KeyQ"
    | "KeyR"
    | "KeyS"
    | "KeyT"
    | "KeyU"
    | "KeyV"
    | "KeyW"
    | "KeyX"
    | "KeyY"
    | "KeyZ"
    | "Minus"
    | "Period"
    | "Quote"
    | "Semicolon"
    | "Slash"
    // Functional keys
    | "AltLeft"
    | "AltRight"
    | "Backspace"
    | "CapsLock"
    | "ContextMenu"
    | "ControlLeft"
    | "ControlRight"
    | "Enter"
    | "MetaLeft"
    | "MetaRight"
    | "ShiftLeft"
    | "ShiftRight"
    | "Space"
    | "Tab"
    // Navigation keys
    | "ArrowDown"
    | "ArrowLeft"
    | "ArrowRight"
    | "ArrowUp"
    | "End"
    | "Home"
    | "PageDown"
    | "PageUp"
    // Editing keys
    | "Delete"
    | "Insert"
    // UI keys
    | "Escape"
    | "PrintScreen"
    | "ScrollLock"
    | "Pause"
    // Function keys
    | "F1"
    | "F2"
    | "F3"
    | "F4"
    | "F5"
    | "F6"
    | "F7"
    | "F8"
    | "F9"
    | "F10"
    | "F11"
    | "F12"
    | "F13"
    | "F14"
    | "F15"
    | "F16"
    | "F17"
    | "F18"
    | "F19"
    | "F20"
    | "F21"
    | "F22"
    | "F23"
    | "F24"
    // Numpad keys
    | "Numpad0"
    | "Numpad1"
    | "Numpad2"
    | "Numpad3"
    | "Numpad4"
    | "Numpad5"
    | "Numpad6"
    | "Numpad7"
    | "Numpad8"
    | "Numpad9"
    | "NumpadAdd"
    | "NumpadBackspace"
    | "NumpadClear"
    | "NumpadClearEntry"
    | "NumpadComma"
    | "NumpadDecimal"
    | "NumpadDivide"
    | "NumpadEnter"
    | "NumpadEqual"
    | "NumpadHash"
    | "NumpadMemoryAdd"
    | "NumpadMemoryClear"
    | "NumpadMemoryRecall"
    | "NumpadMemoryStore"
    | "NumpadMemorySubtract"
    | "NumpadMultiply"
    | "NumpadParenLeft"
    | "NumpadParenRight"
    | "NumpadStar"
    | "NumpadSubtract"
    | "NumLock"
    // Media keys
    | "AudioVolumeDown"
    | "AudioVolumeMute"
    | "AudioVolumeUp"
    | "MediaPlayPause"
    | "MediaSelect"
    | "MediaStop"
    | "MediaTrackNext"
    | "MediaTrackPrevious"
    // Browser keys
    | "BrowserBack"
    | "BrowserFavorites"
    | "BrowserForward"
    | "BrowserHome"
    | "BrowserRefresh"
    | "BrowserSearch"
    | "BrowserStop"
    // OS / misc
    | "Fn"
    | "FnLock"
    | "Hyper"
    | "Power"
    | "Sleep"
    | "Super"
    | "Turbo"
    | "Abort"
    | "Resume"
    | "Suspend"
    | "Again"
    | "Copy"
    | "Cut"
    | "Find"
    | "Open"
    | "Paste"
    | "Props"
    | "Select"
    | "Undo"
    | "WakeUp"
    | "LaunchApp1"
    | "LaunchApp2"
    | "LaunchMail"
    | "LaunchMediaPlayer";
