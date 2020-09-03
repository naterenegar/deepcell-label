"""Feedback classes for comparing np arrays before and after quality control."""
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import numpy as np
from matplotlib import pyplot as plt
from skimage.segmentation import find_boundaries

from caliban import View
from imgutils import pngify


class Feedback(View):
    """Class to view feedback from quality control on zstack images."""
    def __init__(self, input_img, output_img):

        self.input_img = input_img
        self.output_img = output_img

        super(Feedback, self).__init__(input_img)

        self.color_map.set_under(color='white')

    def change_img(self, source):
        """
        Changes the img attribute from the View class.

        Args:
            source (str): expects 'input' or 'output'
                          assumes 'output' if not 'input'
        """
        self._y_changed = True
        if source == 'input':
            self.img = self.input_img
        else:
            self.img = self.output_img


    def get_max_label(self):
        """
        Returns:
            int: maximum label for the current feature between both
                 input and output labels
        """
        input_max = self.input_img.get_max_label(self.feature)
        output_max = self.output_img.get_max_label(self.feature)
        return max(input_max, output_max)
    
    def get_input_frame(self):
        """
        Returns:
            ndarray: input labels for the current frame and feature
        """
        return self.input_img.annotated[self.current_frame, ..., self.feature]
    
    def get_output_frame(self):
        """
        Returns:
            ndarray: output labels for the current frame and feature
        """
        return self.output_img.annotated[self.current_frame, ..., self.feature]

    def deleted_mask(self):
        """
        Returns:
            ndarray: 2d mask array that is False for deleted label area
        """
        input_frame = self.get_input_frame()
        output_frame = self.get_output_frame()
        return ~((input_frame != 0) & (output_frame == 0))

    def added_mask(self):
        """
        Returns:
            ndarray: 2d mask array that is False for added label area
        """
        input_frame = self.get_input_frame()
        output_frame = self.get_output_frame()
        return ~((input_frame == 0) & (output_frame != 0))

    def conv_mask(self):
        """
        Returns:
            ndarray: 2d mask array that is False for converted label area
        """
        input_frame = self.get_input_frame()
        output_frame = self.get_output_frame()
        return ~((input_frame != output_frame) & (input_frame != 0) & (output_frame != 0))

    def deleted_diff(self):
        """Show the deleted label diff by outlining the deleted areas with the original
        label color."""
        input_frame = self.get_input_frame()
        # frame = frame.astype(np.int16) ??
        mask = self.deleted_mask()
        boundary = find_boundaries(mask, mode='outer')
        outlined = np.where(boundary == 1, input_frame, 0)
        # Mask the everywhere but the boundary
        return np.ma.array(outlined, mask=~boundary)

    def added_diff(self):
        """
        Show the added label diff by outlining the added areas with the new
        label color.
        """
        output_frame = self.get_output_frame()
        # frame = frame.astype(np.int16) ??
        mask = self.added_mask()
        boundary = find_boundaries(mask, mode='outer')
        outlined = np.where(boundary == 1, output_frame, -1)  # -1 represents new label area
        # Mask the non added area
        return np.ma.array(outlined, mask=mask)

    def conv_diff(self):
        """
        Show the converted label diff by outlining the converted areas with the new
        label color.
        """
        input_frame = self.get_input_frame()
        output_frame = self.get_output_frame()
        # frame = frame.astype(np.int16) ??
        mask = self.conv_mask()
        boundary = find_boundaries(mask, mode='outer')
        outlined = np.where(boundary == 1, output_frame, input_frame)
        # Mask the non added area
        return np.ma.array(outlined, mask=mask)

    def get_diff(self, frame):
        """Combine all diffs into one frame"""
        self.current_frame = frame
        added = self.added_diff()
        deleted = self.deleted_diff()
        conv = self.conv_diff()
        # # Check for overlap between area
        # if (~(added.mask | deleted.mask) | ~(added.mask | conv.mask) | ~(deleted.mask | conv.mask)).any():
        #     raise(ValueError("Ambiguous differences between input and output"))
        diff_vals = added.filled(0) + deleted.filled(0) + conv.filled(0)
        diff_mask = added.mask & deleted.mask & conv.mask
        diff = np.ma.array(diff_vals, mask=diff_mask)
        return pngify(imgarr=diff,
                      vmin=0,
                      vmax=self.get_max_label(),
                      cmap=self.color_map)


def labels_in_area(labels, area):
    """
    Given a labeling and an boolean array,
    returns a list of the unique labels in the True area.
    """
    return np.unique(labels[area])


def fraction_of_area(area):
    """
    Returns the fraction of the boolean area that is True.
    """
    return area.mean()
