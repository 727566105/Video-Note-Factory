def is_cuda_available() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False

def is_torch_installed() -> bool:
    try:
        import torch
        return True
    except ImportError:
        return False

def is_openvino_available() -> bool:
    try:
        import openvino
        return True
    except ImportError:
        return False

def is_intel_gpu_available() -> bool:
    try:
        import openvino as ov
        core = ov.Core()
        devices = core.available_devices
        if 'GPU' in devices:
            return True
        return False
    except Exception:
        return False

def get_available_devices() -> list:
    devices = ['cpu']
    try:
        import torch
        if torch.cuda.is_available():
            devices.append('cuda')
    except ImportError:
        pass
    
    try:
        import openvino as ov
        core = ov.Core()
        available = core.available_devices
        if 'GPU' in available:
            devices.append('openvino')
    except ImportError:
        pass
    
    return devices