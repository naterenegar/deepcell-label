"""Tests for the Caliban Flask App."""

import os

from flask_sqlalchemy import SQLAlchemy
import numpy as np
import pytest
from pytest_lazyfixture import lazy_fixture

from application import create_app  # pylint: disable=C0413
from files import CalibanFile

# flask-sqlalchemy fixtures from http://alexmic.net/flask-sqlalchemy-pytest/


TESTDB_PATH = '/tmp/test_project.db'
TEST_DATABASE_URI = 'sqlite:///{}'.format(TESTDB_PATH)


@pytest.fixture
def app():
    """Session-wide test `Flask` application."""

    if os.path.exists(TESTDB_PATH):
        os.unlink(TESTDB_PATH)

    yield create_app(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI=TEST_DATABASE_URI,
    )

    os.unlink(TESTDB_PATH)


@pytest.fixture
def _db(app):
    """
    Provide the transactional fixtures with access to the database via a Flask-SQLAlchemy
    database connection.

    https://pypi.org/project/pytest-flask-sqlalchemy/
    """
    db = SQLAlchemy(app=app)
    return db

# File fixtures
HEIGHT = 32
WIDTH = 32
RES = (HEIGHT, WIDTH)
FRAMES = 5
CHANNELS = 3
FEATURES = 2

TEST_NAMES = ["empty", "full1", "full2", "iden", "tril1",
              "triu1", "tril2", "triu2", "triu1l2", "tril1u2",
              "checkerboard01", "checkerboard12"]
tri_12 = np.triu(np.ones(RES, dtype=np.int16))
tri_12[tri_12 == 0] = 2
tri_21 = np.tril(np.ones(RES, dtype=np.int16))
tri_21[tri_21 == 0] = 2
check01 = np.array([[0, 1], [1, 0]], dtype=np.int16)
check12 = np.array([[1, 2], [2, 1]], dtype=np.int16)
TEST_FRAMES = [np.zeros(RES, dtype=np.int16),  # empty
               np.ones(RES, dtype=np.int16),  # all ones
               np.full(RES, 2, dtype=np.int16),  # all twos
               np.identity(HEIGHT, dtype=np.int16),  # identity
               np.tril(np.ones(RES, dtype=np.int16)),  # lower triangular ones
               np.triu(np.ones(RES, dtype=np.int16)),  # upper triangular ones
               np.tril(np.full(RES, 2, dtype=np.int16)),  # lower triangular twos
               np.triu(np.full(RES, 2, dtype=np.int16)),  # upper triangular twos
               tri_12,
               tri_21,
               np.tile(check01, (HEIGHT // 2, WIDTH // 2)),
               np.tile(check12, (HEIGHT // 2, WIDTH // 2)),
               ]
assert len(TEST_NAMES) == len(TEST_FRAMES)


def repeat_feature(feature, n):
    """Repeats a feature n times along the last axis."""
    return np.repeat(
        np.expand_dims(feature, axis=-1),
        n,
        axis=-1)


def repeat_frame(frame, n):
    """Repeats a frame n times along the first axis."""
    return np.repeat(
        np.expand_dims(frame, axis=0),
        n,
        axis=0)


@pytest.fixture(params=TEST_FRAMES, ids=TEST_NAMES)
def zstack_file(mocker, request):
    def load(self):
        data = {'raw': np.zeros((FRAMES, HEIGHT, WIDTH, CHANNELS))}
        data['annotated'] = repeat_frame(repeat_feature(request.param, FEATURES), FRAMES)
        return data
    mocker.patch('files.CalibanFile.load', load)
    return CalibanFile('filename.npz', 'bucket', 'path', 'raw', 'annotated')


@pytest.fixture(params=TEST_FRAMES, ids=TEST_NAMES)
def track_file(mocker, request):
    def load(self):
        data = {'raw': np.zeros((FRAMES, HEIGHT, WIDTH, CHANNELS))}
        data['tracked'] = repeat_frame(repeat_feature(request.param, 1), FRAMES)
        lineages = [{label: {'frame_div': None,
                             'daughters': [],
                             'frames': list(range(FRAMES)),  # All labels are in all frames
                             'label': label,
                             'capped': False,  # TODO: what does this mean?
                             'parent': None}
                    for label in np.unique(request.param) if label != 0}]
        data['lineages'] = lineages
        return data
    mocker.patch('files.CalibanFile.load', load)
    return CalibanFile('filename.trk', 'bucket', 'path', 'raw', 'tracked')


@pytest.fixture(params=[
    lazy_fixture('zstack_file'),
    lazy_fixture('track_file'),
])
def file_(request):
    return request.param
