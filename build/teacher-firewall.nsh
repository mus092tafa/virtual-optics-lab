; The teacher's installer lets the application through Windows Firewall, so
; that the students' laptops reach the classroom on any network. Windows
; otherwise asks the first time a classroom is opened and, with the default
; answer, blocks it on a network it classes as Public (a phone hotspot or an
; unknown router). Changing the firewall needs administrator rights: Windows
; asks once, and the installation goes on as usual when that is declined.

; One rule per installation, so that each user account of the laptop gets its own.
!define CLASSROOM_RULE "Virtual Optics Lab Teacher classroom ($INSTDIR)"

!macro customInstall
  ; Reinstalling or updating asks nothing when the rule is already there.
  nsExec::Exec '"$SYSDIR\netsh.exe" advfirewall firewall show rule name="${CLASSROOM_RULE}"'
  Pop $0
  ${if} $0 != 0
    ; Rules Windows made from an earlier answer to its question go first: a blocking one would win over the new rule.
    ExecShellWait "runas" "$SYSDIR\cmd.exe" '/s /c "netsh advfirewall firewall delete rule name=all program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" & netsh advfirewall firewall add rule name="${CLASSROOM_RULE}" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes profile=any"' SW_HIDE
  ${endif}
!macroend

!macro customUnInstall
  ; An update runs the old uninstaller first; the rule stays for the new version.
  ${ifNot} ${isUpdated}
    nsExec::Exec '"$SYSDIR\netsh.exe" advfirewall firewall show rule name="${CLASSROOM_RULE}"'
    Pop $0
    ${if} $0 == 0
      ExecShellWait "runas" "$SYSDIR\cmd.exe" '/s /c "netsh advfirewall firewall delete rule name=all program="$INSTDIR\${APP_EXECUTABLE_FILENAME}""' SW_HIDE
    ${endif}
  ${endif}
!macroend
