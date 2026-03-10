; Custom NSIS hooks for Perfect Text installer
; Asks user if they want a desktop shortcut after installation

!macro CUSTOM_PAGE_AFTER_INSTALL
  ; Ask the user if they want a desktop shortcut
  MessageBox MB_YESNO|MB_ICONQUESTION "Ali želite ustvariti bližnjico na namizju?" IDNO skipShortcut
    CreateShortCut "$DESKTOP\Perfect Text.lnk" "$INSTDIR\Perfect Text.exe" "" "$INSTDIR\Perfect Text.exe" 0
  skipShortcut:
!macroend

!macro CUSTOM_UNPAGE_AFTER_UNINSTALL
  ; Remove desktop shortcut on uninstall (if it exists)
  Delete "$DESKTOP\Perfect Text.lnk"
!macroend
