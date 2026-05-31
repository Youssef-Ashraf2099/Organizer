"""
main_bundle.py — Entry point for the PyInstaller-compiled AI engine.

Accepts the same --host / --port arguments that mod.rs passes, then starts
uvicorn programmatically so the binary behaves exactly like the dev server.
"""

import argparse
import uvicorn

def main():
    parser = argparse.ArgumentParser(description="Omni AI Engine")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    args = parser.parse_args()

    uvicorn.run(
        "main:app",
        host=args.host,
        port=args.port,
        log_level="info",
        # Don't use reload in production binary
        reload=False,
    )

if __name__ == "__main__":
    main()
