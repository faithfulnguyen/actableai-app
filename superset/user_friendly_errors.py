errors = {
  'utf-8': 'Make sure your data is encoded with "utf-8"'
}

def get_user_friendly_error(errorId: str):
  message = errors.get(errorId)
  return message or errorId
