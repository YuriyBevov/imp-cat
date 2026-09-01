on run argv
  set targetPath to item 1 of argv
  set targetFile to POSIX file targetPath
  tell application "Microsoft Word"
    open targetFile
    delay 2
    if (count of documents) is 0 then error "Word did not open the document"
    set openedDocument to active document
    set openedName to name of openedDocument
    close openedDocument saving do not save changes
    return openedName
  end tell
end run
