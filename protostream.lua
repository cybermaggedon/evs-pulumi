-- Outputs events as PDUs in a stream.  PDUs are protobuf enoded, and have
-- a 4-byte length header.
local observer = {}

-- Other modules -----------------------------------------------------------
local os = require("os")
local json = require("json")
local string = require("string")
local socket = require("socket")
local mime = require("mime")

-- Config ------------------------------------------------------------------

local default_host = "localhost"
if os.getenv("STREAM_HOST") then
  host = os.getenv("STREAM_HOST")
else
  host = default_host
end

local default_port = 6789
if os.getenv("STREAM_PORT") then
  port = tonumber(os.getenv("STREAM_PORT"))
else
  port = default_port
end

print("Host:" .. host)
print("Port:" .. port)

local init = function()
  sender = socket.tcp()
  a = sender:connect(host, port)
  print("Connected.")
end

-- Object submission function - just pushes the object onto the queue.
local submit = function(data)

  len = string.len(data)

  lenb = string.char((len >> 24) & 255, (len >> 16) & 255, (len >> 8) & 255,
    len & 255)

  pdu = lenb .. data

  while true do

    a = sender:send(pdu)
    if a ~= nil then
      break
    end

    print("Socket delivery failed, will reconnect.")
    socket.select(nil, nil, 1)
    init()

  end

end

observer.event = function(e)
  submit(e:protobuf())
end

-- Initialise
init()

-- Return the table
return observer

