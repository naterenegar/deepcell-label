"""Test for File classes"""

import pytest
import numpy as np

from images import CalibanImage


def test_init(image):
    raw = image.raw
    ann = image.annotated
    assert raw.shape[:-1] == ann.shape[:-1]
    assert raw.shape[-1] == image.channel_max
    assert ann.shape[-1] == image.feature_max
    assert raw.shape[0] == image.max_frames
    assert raw.shape[1] == image.height
    assert raw.shape[2] == image.width

    assert len(image.cell_ids) == image.feature_max
    assert len(image.cell_info) == image.feature_max
    for feature in range(image.feature_max):
        assert len(image.cell_ids[feature]) == len(image.cell_info[feature])
