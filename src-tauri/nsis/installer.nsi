; Custom NSIS hooks for Perfect Text installer
; Asks user if they want a desktop shortcut after installation

!macro CUSTOM_PAGE_AFTER_INSTALL
  ; Ask the user if they want a desktop shortcut
  ; Multi-language: detect NSIS language
  StrCmp $LANGUAGE 1060 0 +3
    ; Slovenian
    MessageBox MB_YESNO|MB_ICONQUESTION "Ali želite ustvariti bližnjico na namizju?" IDNO skipShortcut
    Goto checkResult
  StrCmp $LANGUAGE 1040 0 +3
    ; Italian
    MessageBox MB_YESNO|MB_ICONQUESTION "Vuoi creare un collegamento sul desktop?" IDNO skipShortcut
    Goto checkResult
  ; Default: English
  MessageBox MB_YESNO|MB_ICONQUESTION "Would you like to create a desktop shortcut?" IDNO skipShortcut

  checkResult:
    CreateShortCut "$DESKTOP\Perfect Text.lnk" "$INSTDIR\Perfect Text.exe" "" "$INSTDIR\Perfect Text.exe" 0
  skipShortcut:
!macroend

!macro CUSTOM_UNPAGE_AFTER_UNINSTALL
  ; Remove desktop shortcut on uninstall (if it exists)
  Delete "$DESKTOP\Perfect Text.lnk"
!macroend
