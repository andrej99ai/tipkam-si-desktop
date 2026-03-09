; Custom NSIS hooks for Perfect Text installer
; Adds desktop shortcut option during installation

!macro CUSTOM_PAGE_AFTER_INSTALL
  ; Create desktop shortcut after install
  CreateShortCut "$DESKTOP\Perfect Text.lnk" "$INSTDIR\Perfect Text.exe" "" "$INSTDIR\Perfect Text.exe" 0
!macroend

!macro CUSTOM_UNPAGE_AFTER_UNINSTALL
  ; Remove desktop shortcut on uninstall
  Delete "$DESKTOP\Perfect Text.lnk"
!macroend
